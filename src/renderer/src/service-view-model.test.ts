import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServiceDefinition } from "../../shared/services.ts";
import {
  filterAndSortServices,
  type ServiceViewOptions,
} from "./service-view-model.ts";

function service(
  label: string,
  overrides: Partial<ServiceDefinition> = {},
): ServiceDefinition {
  return {
    id: `service:${label}`,
    label,
    displayName: label,
    manager: "launchd",
    kind: "user-agent",
    scope: "user",
    ownership: "third-party",
    status: "stopped",
    startup: "on-demand",
    arguments: [],
    relatedProcessIds: [],
    relatedProcesses: [],
    relatedListenerIds: [],
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [],
    ...overrides,
  };
}

function options(
  overrides: Partial<ServiceViewOptions> = {},
): ServiceViewOptions {
  return {
    query: "",
    manager: "all",
    status: "all",
    startup: "all",
    scope: "all",
    includeApple: false,
    includeApplicationJobs: false,
    sort: "status",
    locale: "en",
    ...overrides,
  };
}

describe("Services view model", () => {
  const inventory = [
    service("Third Party", {
      status: "running",
      program: "/opt/example/bin/agent",
    }),
    service("Apple Job", { ownership: "apple", status: "failed" }),
    service("App Runtime", {
      ownership: "application",
      status: "running",
    }),
    service("Homebrew Database", {
      manager: "homebrew",
      scope: "system",
      status: "disabled",
      startup: "disabled",
      relatedProcesses: [
        {
          pid: 42,
          processName: "postgres",
          command: "postgres -D /data",
          relationship: "direct",
        },
      ],
    }),
  ];

  it("hides Apple and transient application jobs by default", () => {
    assert.deepEqual(
      filterAndSortServices(inventory, options()).map(({ label }) => label),
      ["Third Party", "Homebrew Database"],
    );
  });

  it("can include both hidden ownership categories", () => {
    assert.equal(
      filterAndSortServices(
        inventory,
        options({
          includeApple: true,
          includeApplicationJobs: true,
        }),
      ).length,
      4,
    );
  });

  it("combines manager, status, startup, and scope filters", () => {
    assert.deepEqual(
      filterAndSortServices(
        inventory,
        options({
          manager: "homebrew",
          status: "disabled",
          startup: "disabled",
          scope: "system",
        }),
      ).map(({ label }) => label),
      ["Homebrew Database"],
    );
  });

  it("searches exact evidence fields and sorts deterministically", () => {
    assert.deepEqual(
      filterAndSortServices(
        inventory,
        options({ query: "postgres", sort: "name" }),
      ).map(({ label }) => label),
      ["Homebrew Database"],
    );

    assert.deepEqual(
      filterAndSortServices(
        inventory,
        options({
          includeApple: true,
          includeApplicationJobs: true,
          sort: "status",
        }),
      ).map(({ label }) => label),
      ["Apple Job", "App Runtime", "Third Party", "Homebrew Database"],
    );
  });
});
