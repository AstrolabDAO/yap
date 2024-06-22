import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/vue";
import { ASTROLAB_CDN, W3M_PROJECTID } from "../../common/constants";
import { clearNetworkTypeFromSlug } from "../../common/utils";
import state from "./state";

const featuredWallets = {
  //metamask: "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  // coinbase: "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  trust: "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  rainbow: "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
  // zerion: "ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18",
  // argent: "bc949c5d968ae81310268bf9193f9c9fb7bb4e1283e1284af8f2bd4992535fd6",
  safe: "225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f",
  fireblocks:
    "5864e2ced7c293ed18ac35e0db085c09ed567d67346ccb6f58a0327a75137489",
  ledgerlive:
    "19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927",
  phantom: "a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393",
};

const bridgeableNetworks = [
  "ethereum-mainnet",
  "polygon-mainnet",
  "arbitrum-mainnet-one",
  "optimism-mainnet",
  "base-mainnet",
  "zksync-era-mainnet",
  "fantom-mainnet-opera",
  "avalanche-mainnet",
  "bnb-chain-mainnet",
  "gnosis-mainnet",
  "scroll-mainnet",
  "linea-mainnet",
  "mantle-mainnet",
  "celo-mainnet",
  "moonbeam-mainnet",
  "kava-mainnet",
];

export const setupWeb3Modal = async () => {

  await state.initNetworkProviders();

  // 1. Get projectId
  const projectId = W3M_PROJECTID;

  const chainImages: { [id: number]: string } = {};
  for (const id of state.usedChainIds) {
    chainImages[<number>id] = `${ASTROLAB_CDN}/assets/images/networks/${clearNetworkTypeFromSlug(
      state.networkById.get(id)!.slug
    )}.svg`;
  }
  const chains = bridgeableNetworks
    .map((n) => state.networkById.get(n))
    .map((n) => ({
      chainId: n!.id!,
      name: n!.name!,
      explorerUrl: n!.explorers[0]!,
      rpcUrl: n!.httpRpcs[0]!,
      currency: "ETH",
    }));
  const ethersConfig = defaultConfig({
    chains: bridgeableNetworks
      .map((n) => state.networkById.get(n))
      .map((n) => ({
        chainId: n!.id!,
        name: n!.name!,
        explorerUrl: n!.explorers[0]!,
        rpcUrl: n!.httpRpcs[0]!,
        currency: "ETH",
      })),
    metadata: {
      name: "Astrolab YAP",
      description: "YAP is a decentralized governance platform.",
      url: "https://yap.astrolab.fi",
      icons: ["/images/logo.png"],
    },
  });

  state.web3modal = createWeb3Modal({
    projectId,
    chains,
    ethersConfig,
    chainImages,
    featuredWalletIds: Object.values(featuredWallets),
    themeMode: (state.user?.settings?.theme ?? "dark") as any,
    themeVariables: {
      "--w3m-accent": state.theme.primary,
      // '--w3m-color-mix': State.theme.value!.bg[0],
      // '--w3m-color-mix-strength': 40,
      "--w3m-font-family": state.theme.bodyFont,
      "--w3m-font-size-master": ".5rem",
      "--w3m-border-radius-master": ".12rem",
    },
    enableAnalytics: true, // Optional - defaults to your Cloud configuration
    enableOnramp: true // Optional - false as default
  });

  // document.documentElement.style.setProperty(
  //   "--wui-color-modal-bg-base",
  //   State.theme.value!.bg[1]
  // );
  // state.web3Modal.subscribeEvents(event => { refreshData(); });
  // state.web3Modal.subscribeState(state => { refreshData(); });
  return State.web3Modal;
};
