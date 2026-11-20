import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { afterAll, describe, expect, it } from 'vitest'

// Vercel's Node runtime transpiles each API file separately and loads it as
// native ESM ("type": "module"), so relative imports must carry a .js suffix.
// Vitest resolves extensionless imports itself and cannot catch that failure.
describe('athlete-houze report route under native ESM', () => {
	const root = resolve(__dirname, '../../..')
	const outDir = mkdtempSync(join(tmpdir(), 'athlete-houze-esm-'))

	afterAll(() => rmSync(outDir, { recursive: true, force: true }))

	it('loads and answers GET with 405', async () => {
		await build({
			entryPoints: [
				join(root, 'api/integrations/athlete-houze/report.ts'),
				join(root, 'api/_lib/athleteHouzeReporter.ts'),
			],
			outbase: join(root, 'api'),
			outdir: join(outDir, 'api'),
			format: 'esm',
			platform: 'node',
			bundle: false,
			logLevel: 'silent',
		})
		writeFileSync(join(outDir, 'package.json'), '{"type":"module"}')
		symlinkSync(join(root, 'node_modules'), join(outDir, 'node_modules'), 'dir')

		const routeUrl = pathToFileURL(join(outDir, 'api/integrations/athlete-houze/report.js'))
		const probe = `
			const { default: handler } = await import(${JSON.stringify(routeUrl.href)})
			const res = { code: 0, headers: {},
				setHeader(k, v) { this.headers[k] = v },
				status(c) { this.code = c; return this },
				json() { return this } }
			await handler({ method: 'GET', headers: {} }, res)
			process.stdout.write(JSON.stringify({ code: res.code, allow: res.headers.Allow }))
		`
		const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
			cwd: outDir,
			encoding: 'utf8',
			env: { PATH: process.env.PATH },
		})
		expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
		expect(result.status).toBe(0)
		expect(JSON.parse(result.stdout)).toEqual({ code: 405, allow: 'POST' })
	})
})
