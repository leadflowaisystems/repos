import type { DemoStory } from '../story';
import { HARMONY_CARE_CLINIC } from './clinic';
import { BRIGHTPATH_ACADEMY } from './coaching';
import { FORGE_FITNESS_STUDIO } from './gym';
import { NESTORA_PROPERTIES } from './real-estate';
import { AURA_STUDIO_SPA } from './salon';
import { EVERAFTER_WEDDINGS } from './wedding';

/**
 * THE SIX VERTICAL DEMO WORKSPACES.
 *
 * One fictional business per vertical pack except the restaurant, which
 * Corner Cafe already demonstrates and which this list never touches. Each
 * entry is a stable identity — `key` is the namespace every provisioning run
 * finds its own records by — plus the story that fills the workspace.
 *
 * Synthetic demo data for product evaluation. The businesses, the owners and
 * every customer are invented; the login addresses use `headway.demo`, a
 * domain that receives no mail and belongs to nobody.
 */

export const DEMO_NAMESPACE = 'headway-demo';

export type DemoWorkspace = {
  /** Stable namespace key. Never change it once provisioned. */
  key: string;
  businessName: string;
  /** A pack id from /packs. */
  vertical: string;
  areaLabel: string;
  /** The demo owner's login. Fictional, on a domain that receives no mail. */
  loginEmail: string;
  /** The story in one sentence, for the reference doc and the run summary. */
  headline: string;
  story: DemoStory;
};

export const DEMO_WORKSPACES: readonly DemoWorkspace[] = [
  {
    key: 'clinic',
    businessName: HARMONY_CARE_CLINIC.businessName,
    vertical: HARMONY_CARE_CLINIC.vertical,
    areaLabel: 'Baner, Pune',
    loginEmail: 'demo.clinic@headway.demo',
    headline:
      'Patients love the doctor; the new slot plan made the evening wait complaints fall away, and booking confirmations are now the rising problem.',
    story: HARMONY_CARE_CLINIC,
  },
  {
    key: 'coaching',
    businessName: BRIGHTPATH_ACADEMY.businessName,
    vertical: BRIGHTPATH_ACADEMY.vertical,
    areaLabel: 'Karve Nagar, Pune',
    loginEmail: 'demo.coaching@headway.demo',
    headline:
      'Teaching is the strength; a fixed Sunday timetable ended the schedule complaints, and oversized batches after new admissions are what needs attention now.',
    story: BRIGHTPATH_ACADEMY,
  },
  {
    key: 'gym',
    businessName: FORGE_FITNESS_STUDIO.businessName,
    vertical: FORGE_FITNESS_STUDIO.vertical,
    areaLabel: 'Viman Nagar, Pune',
    loginEmail: 'demo.gym@headway.demo',
    headline:
      'Trainers are praised constantly; reworking the evening floor cleared the crowding complaints, and broken equipment is now getting worse.',
    story: FORGE_FITNESS_STUDIO,
  },
  {
    key: 'real_estate',
    businessName: NESTORA_PROPERTIES.businessName,
    vertical: NESTORA_PROPERTIES.vertical,
    areaLabel: 'Hinjewadi, Pune',
    loginEmail: 'demo.realestate@headway.demo',
    headline:
      'Clients trust the team’s honesty, but slow follow-up stays the top complaint — the four-hour callback rule made no clear difference.',
    story: NESTORA_PROPERTIES,
  },
  {
    key: 'salon',
    businessName: AURA_STUDIO_SPA.businessName,
    vertical: AURA_STUDIO_SPA.vertical,
    areaLabel: 'Koregaon Park, Pune',
    loginEmail: 'demo.salon@headway.demo',
    headline:
      'Stylists and staff are loved; a buffer after colour services made appointment delays less common, but they are still the top complaint while pushy upselling starts to rise.',
    story: AURA_STUDIO_SPA,
  },
  {
    key: 'wedding',
    businessName: EVERAFTER_WEDDINGS.businessName,
    vertical: EVERAFTER_WEDDINGS.vertical,
    areaLabel: 'Kalyani Nagar, Pune',
    loginEmail: 'demo.wedding@headway.demo',
    headline:
      'Couples love the decor, but communication before the wedding got worse even after a single coordinator was assigned — the handover is the real gap.',
    story: EVERAFTER_WEDDINGS,
  },
];

/**
 * The marker a demo client carries in its operator notes. How a provisioning
 * run recognises its own business — never by name alone, because a real
 * business could share one.
 */
export function demoMarker(key: string): string {
  return `[${DEMO_NAMESPACE}:${key}]`;
}

export function findDemoWorkspace(key: string): DemoWorkspace | undefined {
  return DEMO_WORKSPACES.find((w) => w.key === key);
}
