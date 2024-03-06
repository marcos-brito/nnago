import fs from "node:fs/promises";

const AVERAGE_WORD_PER_MINUTE = 240;

export async function calculateReadingTime(path) {
  let content = await fs.readFile(path, "utf8");
  let words = content.split(" ");

  return Math.ceil(words.length / AVERAGE_WORD_PER_MINUTE);
}
