// Transpile api/ and src/ file-by-file to native ESM, the way Vercel's Node
// runtime loads them, so the acceptance server runs the deployable modules.
import { mkdirSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

const [root, outDir] = process.argv.slice(2)

function tsFiles(dir) {
	return readdirSync(dir).flatMap(name => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return name === '__tests__' ? [] : tsFiles(path)
		return /\.tsx?$/.test(name) && !/\.(test|spec|d)\.tsx?$/.test(name) ? [path] : []
	})
}

mkdirSync(outDir, { recursive: true })
await build({
	entryPoints: [...tsFiles(join(root, 'api')), ...tsFiles(join(root, 'src'))],
	outbase: root,
	outdir: outDir,
	format: 'esm',
	platform: 'node',
	bundle: false,
	jsx: 'automatic',
	logLevel: 'warning',
})
writeFileSync(join(outDir, 'package.json'), '{"type":"module"}')
symlinkSync(join(root, 'node_modules'), join(outDir, 'node_modules'), 'dir')
