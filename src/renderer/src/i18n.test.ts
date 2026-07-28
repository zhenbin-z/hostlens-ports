import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLocale, localizeWarning, translate } from "./i18n.ts";

describe("HostLens localization", () => {
  it("detects Japanese and Chinese system locales", () => {
    assert.equal(detectLocale(["ja-JP", "en-US"]), "ja");
    assert.equal(detectLocale(["zh-TW", "en-US"]), "zh-CN");
    assert.equal(detectLocale(["fr-FR"]), "en");
  });

  it("translates messages and replaces values", () => {
    assert.equal(translate("ja", "resultCount", { count: 12 }), "12件");
    assert.equal(
      translate("zh-CN", "updated", { time: "13:30:00" }),
      "更新于 13:30:00",
    );
  });

  it("localizes known scanner warnings without hiding unknown evidence", () => {
    assert.equal(
      localizeWarning(
        "ja",
        "Some process details are unavailable because the process exited or macOS restricted access.",
      ),
      "プロセスの終了またはmacOSのアクセス制限により、一部の詳細を取得できません。",
    );
    assert.equal(
      localizeWarning(
        "zh-CN",
        "2 configured launchd item(s) could not be parsed completely.",
      ),
      "有2个Configured launchd Item无法完整解析。",
    );
    assert.equal(
      localizeWarning(
        "ja",
        "Could not inspect /Library/LaunchDaemons.",
      ),
      "Configured Serviceの場所を確認できませんでした：/Library/LaunchDaemons",
    );
    assert.equal(
      localizeWarning("zh-CN", "Original scanner evidence"),
      "Original scanner evidence",
    );
  });
});
