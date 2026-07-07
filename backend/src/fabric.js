const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const grpc = require("@grpc/grpc-js");
const { connect, signers } = require("@hyperledger/fabric-gateway");

function readFirstFile(dirPath) {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in dir: ${dirPath}`);
  return fs.readFileSync(path.join(dirPath, files[0]));
}

function newGrpcConnection(peerEndpoint, tlsCertPath, hostOverride) {
  const tlsRootCert = fs.readFileSync(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": hostOverride,
    "grpc.default_authority": hostOverride,
  });
}

function newIdentityAndSigner(mspId, certPath, keyDir) {
  const credentials = fs.readFileSync(certPath);
  const privateKeyPem = readFirstFile(keyDir);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return {
    identity: { mspId, credentials },
    signer: signers.newPrivateKeySigner(privateKey),
  };
}

function pickPeer(env, which) {
  if (which === "org2") {
    if (!env.PEER2_ENDPOINT || !env.PEER2_TLS_CERT) {
      throw new Error("PEER2_ENDPOINT / PEER2_TLS_CERT belum diset di .env");
    }
    return {
      endpoint: env.PEER2_ENDPOINT,
      tlsCert: env.PEER2_TLS_CERT,
      host: "peer0.org2.example.com",
    };
  }
  return {
    endpoint: env.PEER_ENDPOINT,
    tlsCert: env.PEER_TLS_CERT,
    host: "peer0.org1.example.com",
  };
}

function pickActorIdentity(actor, env) {
  const a = (actor || "dev").toLowerCase();

  if (a === "dev" || a === "developer") {
    return { mspId: env.DEV_MSP, certPath: env.DEV_CERT, keyDir: env.DEV_KEY_DIR };
  }
  if (a === "pembeli") {
    return { mspId: env.PEMBELI_MSP, certPath: env.PEMBELI_CERT, keyDir: env.PEMBELI_KEY_DIR };
  }
  if (a === "bank") {
    return { mspId: env.BANK_MSP, certPath: env.BANK_CERT, keyDir: env.BANK_KEY_DIR };
  }
  if (a === "notary" || a === "notaris") {
    return { mspId: env.NOTARY_MSP, certPath: env.NOTARY_CERT, keyDir: env.NOTARY_KEY_DIR };
  }

  throw new Error(`Unknown actor: ${actor} (pakai: dev | pembeli | bank | notary)`);
}

async function getContractForActor(actor, env, peerWhich = "org1") {
  const channelName = env.CHANNEL_NAME;
  const chaincodeName = env.CHAINCODE_NAME;
  if (!channelName || !chaincodeName) throw new Error("CHANNEL_NAME / CHAINCODE_NAME belum diset");

  const peer = pickPeer(env, peerWhich);
  const cfg = pickActorIdentity(actor, env);
  if (!cfg.mspId || !cfg.certPath || !cfg.keyDir) throw new Error(`Env actor ${actor} belum lengkap`);

  const client = newGrpcConnection(peer.endpoint, peer.tlsCert, peer.host);
  const { identity, signer } = newIdentityAndSigner(cfg.mspId, cfg.certPath, cfg.keyDir);

  const gateway = connect({ client, identity, signer });
  const network = gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);

  return { contract, gateway, client };
}

module.exports = { getContractForActor };
