/** A reviewed, teachable knowledge card compiled from a job debrief. */
export type TeachableCard = {
  title: string;
  trade: string;
  symptom: string;
  rootCause: string;
  fixSteps: string[];
  tools: string[];
  safetyNote: string;
};
