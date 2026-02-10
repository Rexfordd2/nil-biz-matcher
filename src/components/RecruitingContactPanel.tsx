/**
 * RecruitingV2 Contact Panel (Right)
 */

import { useState } from 'react'
import type { NormalizedPlace } from '../hooks/usePlacesSearch'
import type { RecruitingV2Contact, RecruitingV2Status } from '../recruiting/v2/types'
import { OUTREACH_TEMPLATES, fillTemplate } from '../recruiting/v2/templates'
import { exportShortlistCsv } from '../recruiting/v2/storage'
import Select from './ui/Select'
import Textarea from './ui/Textarea'
import Input from './ui/Input'
import Button from './ui/Button'
import { usePlaceDetails } from '../hooks/usePlaceDetails'

type Props = {
  selectedPlace: NormalizedPlace | null
  contact: RecruitingV2Contact | null
  allContacts: RecruitingV2Contact[]
  onUpdateStatus: (placeId: string, status: RecruitingV2Status) => void
  onUpdateNotes: (placeId: string, notes: string) => void
  onUpdateLastContacted: (placeId: string, date: string | null) => void
}

const STATUS_OPTIONS: RecruitingV2Status[] = ['New', 'Shortlisted', 'Contacted', 'FollowUp', 'Responded', 'Closed']

export default function RecruitingContactPanel({
  selectedPlace,
  contact,
  allContacts,
  onUpdateStatus,
  onUpdateNotes,
  onUpdateLastContacted
}: Props) {
  const [notesInput, setNotesInput] = useState(contact?.notes ?? '')
  const [showTemplates, setShowTemplates] = useState(false)
  const { details } = usePlaceDetails(selectedPlace?.placeId)

  // Update notes input when contact changes
  if (contact && notesInput !== contact.notes && document.activeElement?.tagName !== 'TEXTAREA') {
    setNotesInput(contact.notes)
  }

  function handleSaveNotes() {
    if (contact) {
      onUpdateNotes(contact.placeId, notesInput)
    }
  }

  function handleCopyTemplate(templateId: string) {
    const template = OUTREACH_TEMPLATES.find(t => t.id === templateId)
    if (!template || !selectedPlace) return

    const placeholders = {
      orgName: selectedPlace.name,
      athleteName: '[Your Name]',
      sport: '[Your Sport]',
      position: '[Your Position]',
      gradYear: '[Grad Year]',
      highSchool: '[Your School]',
      stats: '[Your Stats]',
      email: '[Your Email]',
      phone: '[Your Phone]',
      videoUrl: '[Video Link]'
    }

    const filled = fillTemplate(template, placeholders)
    const fullMessage = `Subject: ${filled.subject}\n\n${filled.body}`
    
    navigator.clipboard.writeText(fullMessage).then(() => {
      alert('Template copied to clipboard!')
    })
  }

  function handleExportShortlist() {
    const starred = allContacts.filter(c => c.starred)
    if (starred.length === 0) {
      alert('No contacts in shortlist to export')
      return
    }
    exportShortlistCsv(starred)
  }

  function handleSetContacted() {
    if (contact) {
      onUpdateLastContacted(contact.placeId, new Date().toISOString())
      if (contact.status === 'Shortlisted' || contact.status === 'New') {
        onUpdateStatus(contact.placeId, 'Contacted')
      }
    }
  }

  if (!selectedPlace) {
    return (
      <div className="border border-border rounded-lg p-6">
        <div className="text-center text-foreground/70">
          <div className="text-4xl mb-3">👈</div>
          <div>Select a result to view details and track contact</div>
        </div>
        
        {allContacts.filter(c => c.starred).length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Shortlist</div>
              <Button variant="secondary" onClick={handleExportShortlist} className="text-xs">
                Export CSV
              </Button>
            </div>
            <div className="text-sm text-foreground/70">
              {allContacts.filter(c => c.starred).length} contact{allContacts.filter(c => c.starred).length !== 1 ? 's' : ''} saved
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 max-h-[700px] overflow-y-auto">
      <div>
        <div className="font-medium text-lg">{details?.name || selectedPlace.name}</div>
        <div className="text-sm text-foreground/70">
          {details?.formattedAddress || selectedPlace.formattedAddress}
        </div>
      </div>

      {(details?.website || details?.phone) && (
        <div className="grid grid-cols-1 gap-2 text-sm">
          {details.website && (
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60">Website</div>
              <a 
                href={details.website} 
                target="_blank" 
                rel="noreferrer" 
                className="text-blue-500 underline break-all hover:text-blue-400"
              >
                {details.website}
              </a>
            </div>
          )}
          {details.phone && (
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60">Phone</div>
              <div>{details.phone}</div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="font-medium mb-3">Contact Tracking</div>
        
        {contact ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Status</div>
              <Select
                value={contact.status}
                onChange={e => onUpdateStatus(contact.placeId, e.target.value as RecruitingV2Status)}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Last Contacted</div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={contact.lastContactedAt ? new Date(contact.lastContactedAt).toISOString().split('T')[0] : ''}
                  onChange={e => {
                    if (e.target.value) {
                      const date = new Date(e.target.value + 'T12:00:00')
                      onUpdateLastContacted(contact.placeId, date.toISOString())
                    } else {
                      onUpdateLastContacted(contact.placeId, null)
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={handleSetContacted}
                  title="Mark as contacted today"
                >
                  Today
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-foreground/60 mb-1">Notes</div>
              <Textarea
                rows={4}
                placeholder="Add notes about this contact..."
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                onBlur={handleSaveNotes}
              />
              <div className="text-xs text-foreground/60 mt-1">
                Auto-saves on blur
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-foreground/70 mb-3">
            Star this result to start tracking
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Outreach Templates</div>
          <Button
            variant="secondary"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs"
          >
            {showTemplates ? 'Hide' : 'Show'}
          </Button>
        </div>

        {showTemplates && (
          <div className="space-y-2">
            {OUTREACH_TEMPLATES.map(template => (
              <div key={template.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">{template.name}</div>
                  <Button
                    variant="secondary"
                    onClick={() => handleCopyTemplate(template.id)}
                    className="text-xs"
                  >
                    Copy
                  </Button>
                </div>
                <div className="text-xs text-foreground/60">
                  {template.subject}
                </div>
              </div>
            ))}
            <div className="text-xs text-foreground/60 italic mt-2">
              Templates include placeholders like {'{orgName}'} - fill in your details after copying
            </div>
          </div>
        )}
      </div>

      {allContacts.filter(c => c.starred).length > 0 && (
        <div className="border-t border-border pt-4">
          <Button
            variant="secondary"
            onClick={handleExportShortlist}
            className="w-full"
          >
            Export Shortlist CSV ({allContacts.filter(c => c.starred).length})
          </Button>
        </div>
      )}
    </div>
  )
}
