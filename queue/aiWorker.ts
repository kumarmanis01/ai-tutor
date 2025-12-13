import { Worker } from "bullmq";
import { hydrateNotes } from "../scripts/hydrateNotes";
import { hydrateQuestions } from "../scripts/hydrateQuestions";

new Worker("ai-hydration", async job => {
  if (job.name === "notes") await hydrateNotes(job.data);
  if (job.name === "questions") await hydrateQuestions(job.data);
});
