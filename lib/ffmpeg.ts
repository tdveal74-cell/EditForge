export type FfmpegPlan = {
  id: string;
  label: string;
  command: string;
  requiresRubricPass: boolean;
};

export function buildProxyCommand(inputPath: string, outputPath: string): FfmpegPlan {
  return {
    id: "proxy",
    label: "Edit proxy",
    requiresRubricPass: false,
    command: [
      "ffmpeg -y",
      `-i ${shellQuote(inputPath)}`,
      '-vf "scale=1280:-2"',
      "-c:v libx264 -preset veryfast -crf 23",
      "-c:a aac -b:a 128k",
      "-movflags +faststart",
      shellQuote(outputPath),
    ].join(" "),
  };
}

export function buildExportCommand(inputPath: string, outputPath: string): FfmpegPlan {
  return {
    id: "export",
    label: "Master export",
    requiresRubricPass: true,
    command: [
      "ffmpeg -y",
      `-i ${shellQuote(inputPath)}`,
      "-c:v libx264 -preset slow -crf 18",
      "-c:a aac -b:a 192k",
      "-movflags +faststart",
      shellQuote(outputPath),
    ].join(" "),
  };
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function canRun(plan: FfmpegPlan, rubricPass: boolean): boolean {
  if (plan.requiresRubricPass && !rubricPass) return false;
  return true;
}
