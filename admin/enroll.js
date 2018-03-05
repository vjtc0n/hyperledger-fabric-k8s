"use strict";
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Enroll the admin user
 */

var Fabric_Client = require("fabric-client");
var Fabric_CA_Client = require("fabric-ca-client");

var path = require("path");
var util = require("util");
var os = require("os");
var program = require("commander");

var defaultConfig = require("./config");

//
var fabric_client = new Fabric_Client();
var fabric_ca_client = null;
var admin_user = null;
var member_user = null;
var store_path = process.env.KEY_STORE_PATH;
console.log(" Store path:" + store_path);

var Fabric_Utils = require("fabric-client/lib/utils.js");

program
  .version("0.1.0")
  .option("-u, --user []", "User id", "admin")
  .option("--host, --host []", "CA host", defaultConfig.caServer)
  .option(
    "--domain, --domain []",
    "CA domain",
    // process.env.NAMESPACE ? "ca." + process.env.NAMESPACE : null
    defaultConfig.caDomain || defaultConfig.caServer.split(":")[0]
  )
  .option("-p, --password []", "User password", "adminpw")
  .parse(process.argv);

// Fabric_Utils.setConfigSetting(
//   "key-value-store",
//   "fabric-client/lib/impl/CouchDBKeyValueStore.js"
// );

// const keyvalueStoreConfig = {
//   name: "mychannel",
//   url: "http://localhost:5984"
// };
const keyvalueStoreConfig = {
  path: store_path
};

// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore(keyvalueStoreConfig)
  .then(state_store => {
    // assign the store to the fabric client
    fabric_client.setStateStore(state_store);
    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    var crypto_store = Fabric_Client.newCryptoKeyStore(keyvalueStoreConfig);
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);
    var tlsOptions = {
      trustedRoots: [],
      verify: false
    };
    // be sure to change the http to https when the CA is running TLS enabled
    fabric_ca_client = new Fabric_CA_Client(
      (defaultConfig.tlsEnabled ? "https://" : "http://") + program.host,
      tlsOptions,
      program.domain,
      crypto_suite
    );

    // first check to see if the admin is already enrolled
    return fabric_client.getUserContext(program.user, true);
  })
  .then(user_from_store => {
    if (user_from_store && user_from_store.isEnrolled()) {
      console.log("Successfully loaded " + program.user + " from persistence");
      admin_user = user_from_store;
      return null;
    } else {
      // need to enroll it with CA server
      return fabric_ca_client
        .enroll({
          enrollmentID: program.user,
          enrollmentSecret: program.password,
          attr_reqs: [{ name: "permission", optional: true }]
        })
        .then(enrollment => {
          console.log('Successfully enrolled user "' + program.user + '"');
          return fabric_client.createUser({
            username: program.user,
            mspid: defaultConfig.mspID,
            cryptoContent: {
              privateKeyPEM: enrollment.key.toBytes(),
              signedCertPEM: enrollment.certificate
            }
          });
        })
        .then(user => {
          admin_user = user;
          return fabric_client.setUserContext(admin_user);
        })
        .catch(err => {
          console.error(
            "Failed to enroll and persist " +
            program.user +
            ". Error: " +
            err.stack
              ? err.stack
              : err
          );
          throw new Error("Failed to enroll " + program.user);
        });
    }
  })
  .then(() => {
    console.log(
      "Assigned the " +
        program.user +
        " user to the fabric client ::" +
        admin_user.toString()
    );
  })
  .catch(err => {
    console.error("Failed to enroll " + program.user + ": " + err);
  });
