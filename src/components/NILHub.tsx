import Card from './ui/Card'
import Button from './ui/Button'

export default function NILHub() {
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


