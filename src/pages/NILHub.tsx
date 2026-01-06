import React from 'react';
import DisclaimerBanner from '../components/DisclaimerBanner'

/** The NIL Hub page introduces NIL basics and links to deeper resources,
 *  including the Skool community, NIL education articles, and rules/guidelines.
 */
export default function NILHub() {
  return (
    <main className="container py-8 px-4 mx-auto">
      <div className="mb-4">
        <DisclaimerBanner />
      </div>
      <h1 className="text-3xl font-bold mb-4">NIL Hub</h1>
      <p className="mb-6">
        Welcome to your NIL Hub – a curated set of resources to help you understand
        Name, Image, and Likeness, build your brand responsibly, and connect with
        other athletes and parents.  Always involve a parent, guardian or coach
        when exploring NIL opportunities.
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Join our Skool Community</h2>
        <p className="mb-3">
          We host a private community on Skool where athletes and parents can ask
          questions, share experiences, and access step‑by‑step NIL education.
        </p>
        <a
          href="https://www.skool.com/velox-3694/about?ref=ba7d"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-red-600 text-white py-2 px-4 rounded"
        >
          Join the Community
        </a>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">NIL Education & Compliance</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a
              href="https://nilassist.ncaa.org/student-athletes/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              NCAA NIL Assist education hub
            </a>
          </li>
          <li>
            <a
              href="https://www.nilnetwork.com/7-free-ways-to-support-your-athletes-in-nil/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              NIL Network – Free NIL resources
            </a>
          </li>
          <li>
            <a
              href="https://nillawreport.com/product/student-athlete-nil-checklist/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              Student‑Athlete NIL Checklist
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Brand Building & Marketing</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a
              href="https://nilclub.com/blog/athlete-influencer-marketing-that-works-how-brands-and-athletes-grow-together-on-nil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              NIL Club – Athlete influencer marketing that works
            </a>
          </li>
          <li>
            <a
              href="https://www.launchpointhq.com/blog/the-complete-guide-to-nil-influencer-marketing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              LaunchPoint HQ – NIL Influencer Marketing Guide
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Tools & Checklists</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a
              href="https://influencermarketinghub.com/free-influencer-marketing-tools/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              Free influencer marketing tools
            </a>
          </li>
          <li>
            <a
              href="https://nilresourcecenter.org/nil-playbook"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              NIL Resource Center – NIL Playbook
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-2">Next Steps</h2>
        <p>
          Ready to put your learning into action?  Create your athlete profile from
          the “Athlete” tab or explore our deal, content, and recruiting tools from
          the navigation bar above.
        </p>
      </section>
    </main>
  );
}


