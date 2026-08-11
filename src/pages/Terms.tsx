const EFFECTIVE_DATE = 'August 10, 2026'
const SUPPORT_EMAIL = 'monstermasteryfb@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="space-y-2">
			<h2 className="text-xl font-semibold text-white">{title}</h2>
			<div className="space-y-2 text-gray-300">{children}</div>
		</section>
	)
}

export default function Terms() {
	return (
		<main className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8" data-testid="terms-of-use">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-widest text-red-300">NIL Roster · Private beta</p>
				<h1 className="text-3xl font-bold">Terms of Use</h1>
				<p className="text-sm text-gray-400">Effective and last updated: {EFFECTIVE_DATE}</p>
				<p className="text-gray-300">
					These terms govern your use of the NIL Roster website and private-beta application. By creating an account or using
					the service, you agree to these terms and the <a className="underline text-white" href="/privacy">Privacy Notice</a>.
				</p>
			</header>

			<Section title="Eligibility and guardian participation">
				<p>You must be at least 13 to use NIL Roster.</p>
				<p>
					If you are 13–17, a parent or legal guardian must review these terms, authorize the account, and participate in
					decisions involving profile publishing, recruiting contact, or sharing. The adult creating or supervising the
					account represents that they have authority to do so.
				</p>
			</Section>

			<Section title="Private-beta service">
				<p>
					NIL Roster helps users organize athlete information, public-source recruiting paths, relationships, and opportunity
					records. Beta features may be incomplete, change, pause, or be removed. We may set usage limits or manually onboard
					users while the service is being tested.
				</p>
				<p>No fee is charged through NIL Roster unless a price and checkout flow are clearly presented before purchase.</p>
			</Section>

			<Section title="Accounts and security">
				<p>
					Provide accurate account information, protect your password, and notify us if you believe your account has been
					compromised. You are responsible for activity performed through your account unless prohibited by law.
				</p>
			</Section>

			<Section title="No outcome guarantee or professional advice">
				<p>
					NIL Roster does not guarantee scholarships, roster spots, recruiting interest, admission, eligibility, NIL deals,
					income, followers, sponsorships, or athletic outcomes. Fit scores, recommendations, and public-source contact paths
					are organizational aids and may be incomplete or stale.
				</p>
				<p>
					The service does not provide legal, tax, financial, medical, NCAA, school-compliance, or recruiting-agent advice.
					Verify important decisions with qualified professionals and the relevant school, league, governing body, or program.
				</p>
			</Section>

			<Section title="Recruiting and outreach">
				<p>
					NIL Roster does not automatically send messages or submit recruiting forms for you. You are responsible for checking
					public sources, choosing recipients, reviewing every message, and complying with applicable rules before outreach.
				</p>
			</Section>

			<Section title="Your content and permissions">
				<p>
					You keep ownership of information and content you submit. You grant us a limited, non-exclusive permission to host,
					process, display, and back up that content only as needed to provide, secure, and improve the service. You represent
					that you have the right to submit the content and to authorize its use for the account.
				</p>
			</Section>

			<Section title="Acceptable use">
				<ul className="list-disc pl-6 space-y-2">
					<li>Do not impersonate another person or create a misleading athlete identity.</li>
					<li>Do not scrape, spam, harass, or contact people in violation of law, school rules, or platform terms.</li>
					<li>Do not upload confidential records, credentials, malware, or content you do not have permission to use.</li>
					<li>Do not attempt to bypass access controls, probe another user&apos;s data, or disrupt the service.</li>
				</ul>
			</Section>

			<Section title="Public sources and third-party services">
				<p>
					NIL Roster may link to schools, athletics programs, businesses, maps, forms, and other third-party services. We do not
					control their availability, accuracy, privacy practices, eligibility decisions, or terms. Verify a source before
					relying on it or sharing information with it.
				</p>
			</Section>

			<Section title="Suspension and termination">
				<p>
					We may restrict or suspend access to protect users, investigate abuse, comply with law, or address a material breach
					of these terms. You may stop using the service and request account deletion at any time. Some security, legal, and
					transaction records may be retained as described in the Privacy Notice.
				</p>
			</Section>

			<Section title="Beta availability and disclaimers">
				<p>
					The beta is provided on an “as available” basis. To the extent permitted by law, we disclaim implied warranties of
					merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation.
					Nothing in these terms excludes rights or warranties that cannot legally be excluded.
				</p>
			</Section>

			<Section title="Limitation of liability">
				<p>
					To the extent permitted by law, NIL Roster and Athlete Houze will not be liable for indirect, incidental, special,
					consequential, or punitive damages, lost opportunities, lost data, or decisions made from public-source information.
					Any direct liability will be limited to the amount you paid for the service during the six months before the event
					giving rise to the claim, or $100 if you paid nothing. These limits do not apply where prohibited by law.
				</p>
			</Section>

			<Section title="Changes and contact">
				<p>
					We may update these terms as the beta changes. We will post a new effective date and request renewed acceptance when
					a material change requires it. Continued use after the effective date means you accept the updated terms to the
					extent permitted by law.
				</p>
				<p>
					Questions: <a className="underline text-white" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
				</p>
			</Section>
		</main>
	)
}
