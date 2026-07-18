import { Connection, clusterApiUrl } from "@solana/web3.js";

const connections = {};

export function getConnection(network = "devnet") {
  if (!connections[network]) {
    connections[network] = new Connection(clusterApiUrl(network), "confirmed");
  }
  return connections[network];
}
