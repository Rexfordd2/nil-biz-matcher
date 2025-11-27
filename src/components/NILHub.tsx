import Card from './ui/Card'
import Button from './ui/Button'
import { useEffect, useState } from 'react'
import { load, save } from '../utils/storage'

export default function NILHub({ onGoVendors }: { onGoVendors?: () => void }) {
	const [checklist, setChecklist] = useState<Record<string, boolean>>(() => load('finance.checklist', {
		export_log: false,
		collect_payments: false,
		tax_docs: false,
		talk_cpa: false,
		review_llc: false
	}))
	useEffect(() => {
		save('finance.checklist', checklist)
	}, [checklist])

	return (
		<Card title="NIL Rules & Guidelines Hub">
			<div className="space-y-4 text-gray-200">
				<p className="text-white font-semibold">Stay smart. Keep it clean. Bring a parent/guardian along.</p>
				<section className="card p-4">
					<h3 className="headline text-lg mb-1">Learn NIL with Skool (Community)</h3>
					<p className="text-gray-300 mb-3">
						Step-by-step NIL education, office hours, and resources for athletes and parents who want to understand NIL and build their brand the right way.
					</p>
					<a href="https://www.skool.com/velox-3694/about?ref=ba7d" target="_blank" rel="noreferrer" className="btn btn-primary">
						Join NIL learning community
					</a>
				</section>

				{onGoVendors && (
					<section className="card p-4">
						<h3 className="headline text-lg mb-2">Support & Services</h3>
						<p className="text-gray-300 mb-3">
							Looking for help? Browse our informational directory of trusted partners (photographers, editors, trainers, and more).
						</p>
						<div className="flex items-center gap-3">
							<Button onClick={onGoVendors} className="red-glow">Open Vendor Directory</Button>
							<span className="text-xs text-gray-400">Informational only — you must vet and hire your own providers.</span>
						</div>
					</section>
				)}
				<section className="card p-4">
					<h3 className="headline text-lg mb-2">External NIL Resources</h3>
					<ul className="list-disc pl-6 space-y-1">
						<li>
							<a href="https://opendorse.com" target="_blank" rel="noreferrer" className="underline">Opendorse</a> — education and marketplaces
						</li>
						<li>
							<a href="https://www.nil.store" target="_blank" rel="noreferrer" className="underline">NIL.store</a> — athlete merch and storefronts
						</li>
						<li>
							<a href="https://www.nilnetwork.com" target="_blank" rel="noreferrer" className="underline">NIL Network</a> — news and guides
						</li>
					</ul>
				</section>

				<section className="card p-4">
					<h3 className="headline text-lg mb-2">Tax & Entity Prep (Educational)</h3>
					<ul className="space-y-2 text-sm">
						<li className="flex items-center gap-2">
							<input type="checkbox" checked={!!checklist.export_log} onChange={e => setChecklist({ ...checklist, export_log: e.target.checked })} />
							<span>Export deal log for this year</span>
						</li>
						<li className="flex items-center gap-2">
							<input type="checkbox" checked={!!checklist.collect_payments} onChange={e => setChecklist({ ...checklist, collect_payments: e.target.checked })} />
							<span>Collect payment records (bank/account statements)</span>
						</li>
						<li className="flex items-center gap-2">
							<input type="checkbox" checked={!!checklist.tax_docs} onChange={e => setChecklist({ ...checklist, tax_docs: e.target.checked })} />
							<span>Collect W-9 / 1099 / platform summaries</span>
						</li>
						<li className="flex items-center gap-2">
							<input type="checkbox" checked={!!checklist.talk_cpa} onChange={e => setChecklist({ ...checklist, talk_cpa: e.target.checked })} />
							<span>Talk to a CPA about state/local taxes, self-employment taxes, deductible expenses</span>
						</li>
						<li className="flex items-center gap-2">
							<input type="checkbox" checked={!!checklist.review_llc} onChange={e => setChecklist({ ...checklist, review_llc: e.target.checked })} />
							<span>Review whether an LLC/EIN is appropriate with a professional</span>
						</li>
					</ul>
					<p className="text-xs text-gray-400 mt-2">This is educational only and not legal, tax, or financial advice.</p>
				</section>

				<ul className="list-disc pl-6 space-y-2">
					<li>Know your school and state NIL rules. Some schools have extra steps — check your handbook or website.</li>
					<li>Loop in a parent/guardian on messages, meetings, and agreements.</li>
					<li>Be clear: this is not guaranteed income, and deals depend on effort and fit.</li>
					<li>Use simple written agreements: deliverables, dates, and how you’ll get paid.</li>
					<li>Avoid using school logos or marks unless you have official permission.</li>
					<li>Keep content respectful, age-appropriate, and safe for parents and coaches.</li>
					<li>Track promo codes/links so businesses can see results.</li>
					<li>Stay transparent with coaches if you’re doing sponsored posts around games.</li>
				</ul>
			</div>
		</Card>
	)
}


