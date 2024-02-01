export type SolaceConfig = {
  host: string;
  password: string;
  vpn: string;
  username: string;
};

export class Solace {
  solaceConfig!: SolaceConfig;

  constructor() {
    document.body.addEventListener("click", () => {
      this.loadConfig();
    });
  }

  async loadConfig() {
    let extensionPrefix = "solaceQueueViewerExtension.";
    let clusterDiv =
      document.querySelector<HTMLDivElement>("div.data.title div");
    if (clusterDiv == null) return;
    let clusterPrefix = clusterDiv.innerText;
    let prefix = extensionPrefix + clusterPrefix;
    let values = await chrome.storage.local.get();
    this.solaceConfig = {
      host: values[`${prefix}.host`],
      password: values[`${prefix}.password`],
      vpn: values[`${prefix}.vpn`],
      username: values[`${prefix}.username`],
    };
    console.log(this.solaceConfig);
  }
}

new Solace();
