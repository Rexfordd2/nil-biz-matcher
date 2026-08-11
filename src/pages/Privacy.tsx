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

export default function Privacy() {
	return (
		<main className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8" data-testid="privacy-policy">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-widest text-red-300">NIL Roster · Private beta</p>
				<h1 className="text-3xl font-bold">Privacy Notice</h1>
				<p className="text-sm text-gray-400">Effective and last updated: {EFFECTIVE_DATE}</p>
				<p className="text-gray-300">
					This notice explains how NIL Roster collects and uses information while you build an athlete profile,
					organize recruiting, save public-source contacts, and manage opportunities during the beta.
				</p>
			</header>

			<Section title="Who may use NIL Roster">
				<p>NIL Roster is not available to children under 13.</p>
				<p>
					Users ages 13–17 may participate only with a parent or legal guardian involved in account creation and use.
					A parent or guardian may contact us to review, correct, export, or delete a minor&apos;s information.
				</p>
			</Section>

			<Section title="Information we collect">
				<ul className="list-disc pl-6 space-y-2">
					<li>Account details, including display name, role, email address, and authentication records.</li>
					<li>Athlete profile information you choose to add, such as sport, position, graduation year, goals, achievements, links, and recruiting preferences.</li>
					<li>Saved schools, businesses, contacts, notes, opportunity records, recruiting-board activity, and onboarding progress.</li>
					<li>Basic device, log, error, and security information needed to operate and protect the service.</li>
					<li>Messages you send directly to support or through a beta-access form.</li>
				</ul>
				<p>
					Public-source results may come from official athletics pages, Google Maps or Places, and other public websites.
					Their presence in NIL Roster does not mean that a school, coach, business, or organization endorses the service.
				</p>
			</Section>

			<Section title="How we use information">
				<ul className="list-disc pl-6 space-y-2">
					<li>Provide authentication, profiles, recruiting tools, saved opportunities, and account support.</li>
					<li>Keep your records available across signed-in sessions and devices when cloud saving is enabled.</li>
					<li>Protect accounts, prevent abuse, troubleshoot failures, and improve beta workflows.</li>
					<li>Respond to support, access, correction, export, and deletion requests.</li>
				</ul>
			</Section>

			<Section title="Recruiting, outreach, and connected products">
				<p>
					NIL Roster does not automatically contact coaches, schools, recruiters, sponsors, or businesses for you.
					You control any outreach you choose to send.
				</p>
				<p>
					Real-athlete reporting to Athlete Houze, Vanta, or another connected product is disabled in this beta unless a
					separate, athlete-specific consent and account-linking flow is introduced and accepted. Synthetic test records may
					be used to verify integrations without using a real athlete&apos;s identity.
				</p>
			</Section>

			<Section title="Local and cloud storage">
				<p>
					Some preview or offline activity may remain only in your browser. Signed-in account information may be stored in
					our hosted database. Clearing browser storage can remove local-only records, and local-only records may not follow
					you to another device.
				</p>
			</Section>

			<Section title="Service providers and disclosures">
				<p>
					We use service providers such as Supabase for authentication and data hosting, Vercel for application hosting, and
					Google services for public place discovery when enabled. They process information to provide those services under
					their own terms and privacy commitments.
				</p>
				<p>
					We may disclose information when reasonably necessary to comply with law, protect users or the service, investigate
					fraud or abuse, or complete a business transaction subject to appropriate safeguards and notice where required.
				</p>
				<p>We do not sell personal information or use it for cross-context behavioral advertising.</p>
			</Section>

			<Section title="Education records">
				<p>
					NIL Roster is not acting as a school or as a school official by default. Do not upload confidential school records
					unless you have authority to do so and the feature specifically requests them. School-provided education records
					require a separate agreement and appropriate authorization before use.
				</p>
			</Section>

			<Section title="Retention and security">
				<p>
					We retain account information while the account is active and as reasonably needed to provide the beta, resolve
					disputes, meet legal obligations, and maintain security records. We use reasonable administrative and technical
					safeguards, but no online service can guarantee absolute security.
				</p>
			</Section>

			<Section title="Your choices and privacy requests">
				<p>
					You may update profile information in the product and request access, correction, export, or deletion by emailing
					<a className="underline text-white" href={`mailto:${SUPPORT_EMAIL}`}> {SUPPORT_EMAIL}</a>. We may need to verify
					your identity or authority over a minor&apos;s account before completing a request.
				</p>
				<p>
					Where applicable law gives additional rights, including rights to know, correct, delete, limit, or receive equal
					service after exercising a privacy right, we will process a verified request as required by law.
				</p>
			</Section>

			<Section title="Changes and contact">
				<p>
					Beta features and data practices may change. We will update the date on this page and request renewed acknowledgement
					when a material change requires it.
				</p>
				<p>
					Questions or requests: <a className="underline text-white" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
				</p>
			</Section>

			<p className="border-t border-white/10 pt-6 text-sm text-gray-400">
				See also the <a className="underline text-white" href="/terms">NIL Roster Terms of Use</a>.
			</p>
		</main>
	)
}
