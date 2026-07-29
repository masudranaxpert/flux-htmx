import './setup.js';
import { describe, expect, it, vi } from "vitest";
import { readFluxMetaConfig, duplicatePolicy } from "../../src/core/startup.js";
import { installFeedback, resetFeedbackForTests } from "../../src/core/feedback.js";

describe("autoStart: false & Meta Config", () => {
  it("extracts config correctly when autoStart is explicitly false", () => {
    document.head.innerHTML = `
      <meta name="flux-config" content='{"autoStart": false, "duplicatePolicy": "warn"}'>
    `;
    const config = readFluxMetaConfig();
    expect(config.autoStart).toBe(false);
    expect(config.duplicatePolicy).toBe("warn");
  });

  it("extracts configuration options to pass to core.configure", () => {
    document.head.innerHTML = `
      <meta name="flux-config" content='{"offline": {"enabled": true}}'>
    `;
    const config = readFluxMetaConfig();
    expect(config.flux?.offline?.enabled).toBe(true);
  });

  it("handles duplicate policies", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(duplicatePolicy('htmx', {}, 'warn')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    
    expect(() => duplicatePolicy('htmx', {}, 'error')).toThrow();
  });
});
