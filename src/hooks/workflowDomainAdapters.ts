import {
	planDealLegacyImport,
	planEventLegacyImport,
	planOpportunityLegacyImport,
} from '../persistence/workflows/importPlanners'
import {
	deleteDealForUser,
	insertMissingLegacyDeals,
	listDealsForUser,
	upsertDealForUser,
} from '../persistence/workflows/dealRepository'
import {
	deleteEventForUser,
	insertMissingLegacyEvents,
	listEventsForUser,
	upsertEventForUser,
} from '../persistence/workflows/eventRepository'
import {
	deleteOpportunityForUser,
	insertMissingLegacyOpportunities,
	listOpportunitiesForUser,
	upsertOpportunityForUser,
} from '../persistence/workflows/opportunityRepository'
import type { DealLogEntry, EventPlan, Opportunity } from '../types'
import { reportNilRosterOpportunity } from '../lib/athleteHouzeEvidence'
import type { WorkflowDomainAdapters } from './useWorkflowDomainPersistence'

export const opportunityWorkflowAdapters: WorkflowDomainAdapters<Opportunity> = {
	storageKey: 'opps.store',
	listForUser: listOpportunitiesForUser,
	upsertForUser: async (userId, record) => {
		const result = await upsertOpportunityForUser(userId, record)
		if (result.ok) {
			// The helper returns locally for every non-synthetic user. Canary
			// delivery failure never changes the committed Opportunity result.
			await reportNilRosterOpportunity(record.id)
		}
		return result
	},
	deleteForUser: deleteOpportunityForUser,
	insertMissing: insertMissingLegacyOpportunities,
	planImport: planOpportunityLegacyImport,
}

export const dealWorkflowAdapters: WorkflowDomainAdapters<DealLogEntry> = {
	storageKey: 'deals.store',
	listForUser: listDealsForUser,
	upsertForUser: upsertDealForUser,
	deleteForUser: deleteDealForUser,
	insertMissing: insertMissingLegacyDeals,
	planImport: planDealLegacyImport,
}

export const eventWorkflowAdapters: WorkflowDomainAdapters<EventPlan> = {
	storageKey: 'events.store',
	listForUser: listEventsForUser,
	upsertForUser: upsertEventForUser,
	deleteForUser: deleteEventForUser,
	insertMissing: insertMissingLegacyEvents,
	planImport: planEventLegacyImport,
}
