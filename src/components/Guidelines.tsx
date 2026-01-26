import Card from './ui/Card'

export default function Guidelines() {
	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<h2 className="headline text-2xl">NIL Rules & Guidelines</h2>
				<p className="text-gray-300">Read this with a parent/guardian or coach before you start.</p>
			</header>

			<Card>
				<h3 className="text-white font-semibold mb-2">Protect your eligibility first</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>Check your school and state NIL rules; some schools add extra steps.</li>
					<li>Avoid using school logos or marks without official permission.</li>
					<li>Keep deals separate from recruiting, playing time, or promises around games.</li>
				</ul>
			</Card>

			<Card>
				<h3 className="text-white font-semibold mb-2">Don’t do NIL alone</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>Loop in a parent/guardian on messages, meetings, and agreements.</li>
					<li>Ask coaches what’s okay and what to avoid around practices and games.</li>
					<li>Consider professional advice for taxes, contracts, and entities.</li>
				</ul>
			</Card>

			<Card>
				<h3 className="text-white font-semibold mb-2">Don’t let NIL wreck your sport or school</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>School comes first; be honest about time and energy tradeoffs.</li>
					<li>Keep practices, recovery, and games the priority over content.</li>
					<li>Use a simple plan so sponsorships don’t overwhelm your schedule.</li>
				</ul>
			</Card>

			<Card>
				<h3 className="text-white font-semibold mb-2">Know what you’re really trading</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>Deliverables, dates, and payment should be clear and in writing.</li>
					<li>Track links or promo codes so businesses can see results.</li>
					<li>Be realistic: small local fits beat random big promises.</li>
				</ul>
			</Card>

			<Card>
				<h3 className="text-white font-semibold mb-2">Be honest and compliant on content</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>Disclose sponsored content when required by platform rules.</li>
					<li>Keep it respectful, age-appropriate, and safe for parents and coaches.</li>
					<li>Don’t make claims you can’t back up.</li>
				</ul>
			</Card>

			<Card>
				<h3 className="text-white font-semibold mb-2">Athlete Ledger is education, not legal/financial advice</h3>
				<ul className="list-disc pl-6 space-y-2 text-gray-200">
					<li>This app helps you think; it doesn’t replace pros.</li>
					<li>For contracts, taxes, or entities, consult a qualified professional.</li>
					<li>When in doubt, pause and ask first.</li>
				</ul>
			</Card>

			<p className="text-gray-300">
				Close this tab only after you’ve reviewed these with a parent/guardian or coach.
			</p>
		</div>
	)
}


