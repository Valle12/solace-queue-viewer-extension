import { createDefaultStatus, type ChromeMessage, type Status } from "./types";

export class Background {
  amountErrors = 5;
  scriptId = "solace";
  clusterUrlsSet: Set<string> = new Set();
  syncChain: Promise<void> = Promise.resolve();
  statusChain: Promise<void> = Promise.resolve();

  init() {
    // Listeners have to be added synchronously, otherwise the events that wake up the service worker are lost
    chrome.runtime.onInstalled.addListener(() => {
      void this.syncContentScripts();
    });

    chrome.runtime.onStartup.addListener(() => {
      void this.syncContentScripts();
    });

    chrome.storage.local.onChanged.addListener(changes => {
      if (!changes.clusterUrls) return;
      const oldUrls = new Set(
        (changes.clusterUrls.oldValue as string[] | undefined) ?? [],
      );
      const newUrls =
        (changes.clusterUrls.newValue as string[] | undefined) ?? [];
      void this.syncContentScripts(newUrls.filter(url => !oldUrls.has(url)));
    });

    chrome.runtime.onMessage.addListener(tmpMsg => {
      const msg = tmpMsg as ChromeMessage;
      if (msg.type === "sendInfo") void this.setInfo(msg.content);
      else if (msg.type === "sendError") void this.addError(msg.content);
    });

    // On every service worker start, Chrome drops dynamic content scripts on extension updates
    void this.syncContentScripts();
  }

  /** Runs one sync after the other, so a startup sync and a storage change can't race each other */
  syncContentScripts(addedUrls: string[] = []) {
    this.syncChain = this.runSync(this.syncChain, addedUrls);
    return this.syncChain;
  }

  // Never rejects, so a failed sync doesn't block the following ones
  async runSync(previous: Promise<void>, addedUrls: string[]) {
    await previous;
    try {
      await this.applyContentScripts(addedUrls);
    } catch (error) {
      await this.addError(
        `[${new Date().toLocaleTimeString()}] Could not update content script: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Brings the registered content script in line with the saved cluster urls */
  async applyContentScripts(addedUrls: string[]) {
    const js = this.getContentScriptFiles();
    if (!js) return;

    const { clusterUrls } = await chrome.storage.local.get<{
      clusterUrls?: string[];
    }>("clusterUrls");
    this.clusterUrlsSet = new Set(clusterUrls ?? []);
    const matches = this.setToModifiedArray();
    const [registered] = await chrome.scripting.getRegisteredContentScripts({
      ids: [this.scriptId],
    });

    if (matches.length === 0) {
      if (registered) {
        await chrome.scripting.unregisterContentScripts({
          ids: [this.scriptId],
        });
      }
      return;
    }

    if (!registered) {
      await chrome.scripting.registerContentScripts([
        {
          id: this.scriptId,
          js,
          matches,
          runAt: "document_idle",
          persistAcrossSessions: true,
        },
      ]);
    } else if (
      !this.hasSameItems(registered.js, js) ||
      !this.hasSameItems(registered.matches, matches)
    ) {
      await chrome.scripting.updateContentScripts([
        { id: this.scriptId, js, matches },
      ]);
    }

    // The registration only applies to future page loads, so already open tabs of new clusters get it injected
    const added = addedUrls.filter(url => this.clusterUrlsSet.has(url));
    if (added.length === 0) return;
    await this.injectIntoOpenTabs(this.setToModifiedArray(added), js);
  }

  getContentScriptFiles() {
    const war = chrome.runtime.getManifest().web_accessible_resources;
    if (
      !war ||
      !Array.isArray(war) ||
      war.every(item => typeof item === "string")
    ) {
      return;
    }

    return war[0].resources;
  }

  async injectIntoOpenTabs(patterns: string[], js: string[]) {
    const tabs = await chrome.tabs.query({ url: patterns });
    await Promise.allSettled(
      tabs.flatMap(tab =>
        tab.id === undefined ? [] : [this.injectIntoTab(tab.id, js)],
      ),
    );
  }

  async injectIntoTab(tabId: number, js: string[]) {
    // Running the content script twice in a page throws, so check whether it is already there
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => "solaceQueueViewer" in globalThis,
    });
    if (probe?.result) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: js });
  }

  setInfo(info: string) {
    return this.updateStatus(status => ({ ...status, info }));
  }

  addError(error: string) {
    return this.updateStatus(status => ({
      ...status,
      errors: [error, ...status.errors].slice(0, this.amountErrors),
    }));
  }

  /** Read-modify-write one after the other, so errors arriving at the same time don't overwrite each other */
  updateStatus(update: (status: Status) => Status) {
    this.statusChain = this.runStatusUpdate(this.statusChain, update);
    return this.statusChain;
  }

  // Never rejects, so a failed update doesn't block the following ones
  async runStatusUpdate(
    previous: Promise<void>,
    update: (status: Status) => Status,
  ) {
    await previous;
    try {
      const { status } = await chrome.storage.session.get<{
        status?: Status;
      }>("status");
      await chrome.storage.session.set({
        status: update(status ?? createDefaultStatus()),
      });
    } catch (error) {
      // Not reported via addError, that would fail the same way again
      console.error("Could not update status", error);
    }
  }

  setToModifiedArray(urls: Iterable<string> = this.clusterUrlsSet) {
    const patterns = Array.from(urls, url =>
      url.endsWith("/*") ? url : url + "/*",
    );
    return Array.from(new Set(patterns));
  }

  hasSameItems(a: string[] = [], b: string[] = []) {
    const setA = new Set(a);
    const setB = new Set(b);
    return setA.size === setB.size && [...setA].every(item => setB.has(item));
  }
}

if (process.env.NODE_ENV !== "test") {
  const background = new Background();
  background.init();
}
