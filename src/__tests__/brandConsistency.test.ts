import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir: string, files: string[] = []): string[] {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === '__tests__' || entry.name === 'node_modules') continue
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) walk(full, files)
		else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full)
	}
	return files
}

describe('athlete-facing brand', () => {
	it('does not expose "Athlete Ledger" as a consumer brand in UI source or HTML titles', () => {
		const sources = [...walk(path.join(root, 'src')), path.join(root, 'index.html'), path.join(root, 'demo.html')]
		for (const file of sources) {
			const text = fs.readFileSync(file, 'utf8')
			expect(text, file).not.toMatch(/Athlete\s+Ledger/i)
		}
	})

	it('names the app NIL Roster in the document title and app header', () => {
		expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).toMatch(/<title>NIL Roster/)
		expect(fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')).toContain('>NIL Roster</h1>')
	})

	it('athlete-facing recruiting outreach is named Outreach Drafts, not Recruiting Blast', () => {
		const ui = walk(path.join(root, 'src')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
		expect(ui).not.toMatch(/Recruiting Blast['"<]/)
		expect(ui).not.toContain('Send Blast')
		expect(ui).toContain('Outreach Drafts')
	})
})
