import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { afterAll, describe, expect, it } from 'vitest'

// Vercel's Node runtime transpiles each API file separately and loads it as
// native ESM ("type": "module"), so relative value imports need a .js suffix.
// Vitest resolves extensionless imports itself, so load routes in plain Node.
const root = resolve(__dirname, '..')

function tsFiles(dir: string): string[] {
	return readdirSync(dir).flatMap(name => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return name === '__tests__' ? [] : tsFiles(path)
		return /\.ts$/.test(name) && !/\.(test|d)\.ts$/.test(name) ? [path] : []
	})
}

describe('API routes under native ESM', () => {
	const outDir = mkdtempSync(join(tmpdir(), 'api-esm-'))
	afterAll(() => rmSync(outDir, { recursive: true, force: true }))

	it('every route module resolves its imports', async () => {
		const sources = [...tsFiles(join(root, 'api')), ...tsFiles(join(root, 'src'))]
		await build({
			entryPoints: sources,
			outbase: root,
			outdir: outDir,
			format: 'esm',
			platform: 'node',
			bundle: false,
			logLevel: 'silent',
		})
		writeFileSync(join(outDir, 'package.json'), '{"type":"module"}')
		symlinkSync(join(root, 'node_modules'), join(outDir, 'node_modules'), 'dir')

		const routes = tsFiles(join(root, 'api'))
			.filter(path => !relative(root, path).startsWith(join('api', '_lib')))
			.map(path => pathToFileURL(join(outDir, relative(root, path).replace(/\.ts$/, '.js'))).href)
		const probe = `
			const failures = []
			for (const url of ${JSON.stringify(routes)}) {
				try { await import(url) } catch (error) {
					if (String(error?.code).startsWith('ERR_')) failures.push(url.split('/api/')[1] + ': ' + error.code)
				}
			}
			process.stdout.write(JSON.stringify(failures))
		`
		const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
			cwd: outDir,
			encoding: 'utf8',
			env: { PATH: process.env.PATH },
		})
		expect(result.status, result.stderr).toBe(0)
		expect(routes.length).toBeGreaterThan(5)
		expect(JSON.parse(result.stdout)).toEqual([])
	})
})
