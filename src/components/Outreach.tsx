import Card from './ui/Card'
import Button from './ui/Button'
import { AthleteProfile, Business } from '../types'
import { buildOutreach } from '../utils/outreach'
import { generateIdeas } from '../utils/ideas'
import { useToast } from './ui/Toast'

export default function Outreach({ athlete, business }: { athlete: AthleteProfile; business: Business }) {
	const { show } = useToast()
	const ideas = generateIdeas(athlete, business)
	const bundle = buildOutreach(athlete, business, ideas)

	function copy(text: string) {
		navigator.clipboard.writeText(text).then(() => show('Copied to clipboard'))
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<Card title="Partnership Idea Generator">
				<ul className="list-disc pl-6 space-y-2 text-white">
					{ideas.map((i, idx) => <li key={idx}>{i}</li>)}
				</ul>
				<p className="subtle text-sm mt-3">Quick alignment: what they want and how you can help are connected. Keep it simple and trackable.</p>
			</Card>
			<Card title="Outreach Message Builder" actions={<div className="flex gap-2">
				<Button variant="ghost" onClick={() => copy(bundle.dm)}>Copy DM</Button>
				<Button variant="ghost" onClick={() => copy(bundle.email)}>Copy Email</Button>
			</div>}>
				<div className="grid grid-cols-1 gap-4">
					<div>
						<div className="subtle text-xs mb-2">DM Version</div>
						<pre className="bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-sm">{bundle.dm}</pre>
					</div>
					<div>
						<div className="subtle text-xs mb-2">Email Version</div>
						<pre className="bg-mid border border-border rounded-md p-3 whitespace-pre-wrap text-gray-100 text-sm">{bundle.email}</pre>
					</div>
				</div>
			</Card>
		</div>
	)
}


