var Web3 = require('web3');
var R = require("r-script");
var csv = require("array-to-csv");
var fs = require('fs');
var net = require('net');
var exec = require('child_process').exec;
var MongoClient = require('mongodb').MongoClient;
var hash = require('string-hash') // number between 0 and 4294967295, inclusive
var cassandra = require('cassandra-driver');

// Batch size
var n = 2000;
// Whether to write to CSV
var CSVWrite = true;

// Using the IPC provider in node.js
const GETH_IPC_PATH = '/ethereum/red-principal/geth.ipc';
var web3 = new Web3();
web3.setProvider(GETH_IPC_PATH, net);

var express = require('express'),
  router = express.Router();

module.exports = function(app) {
  app.use('/', router);
};



/*
----- Resolving API calls -----
*/

router.get('/', function(req, res) {
  res.render('index', {
    title: 'Ethereum Tracking',
    notFound: ""
  })
})

router.get('/index.html', function(req, res) {
  res.render('index', {
    title: 'Ethereum Tracking',
    notFound: ""
  })
})

router.get('/tx', function(req, res) {
  res.render('tx', {
    title: 'Ethereum Tracking',
    notFound: "<"
  })
})

// Calls the function to get a random tx
router.get('/getTxRandom', function(req, res) {
  var blockNumberParam = req.query.num;
  getRandomTx(blockNumberParam, res, false);
});

// Finds the graph for this tx
router.get('/getTxTree', function(req, res) {
  var nodes = 250;
  var nOfBlocksToSearch = 10000;
  var txList = [];
  var type = req.query.type;

  if (req.query.nodeNum != "" && req.query.nodeNum != null && req.query.nodeNum != undefined) {
    nodes = req.query.nodeNum;
  }
  if (req.query.bsNumber != "" && req.query.bsNumber != null && req.query.bsNumber != undefined) {
    nOfBlocksToSearch = parseInt(req.query.bsNumber);
  }

  //var currentNumberOfBlocks = 6218385;
  //We will use this until populating Mongo with the whole chain
  var currentNumberOfBlocks = 300000;
  var chosenBlockNumber = Math.random() * (currentNumberOfBlocks);
  var chosenBlock = Math.round(chosenBlockNumber);

  chosenBlock = 5000000 + chosenBlock;
  //

  // Regex worth it?
  var tx = req.query.tx;
  resGlobal = res;
  if (tx == "" || tx == null || tx == undefined) {
    tx = getRandomTx(chosenBlock, res, true, nodes, nOfBlocksToSearch, txList, type);
  } else {
    txList.push(tx);
    console.log("The nodeNumber is: " + nodes + ".\n The nOfBlocksToSearch is: " + nOfBlocksToSearch + ".\n The TX to search is (custom): " + tx + ".\n");
    getTxInfo(tx, res, nodes, nOfBlocksToSearch, txList, type);
  }
});



/*
----- R scripts -----
*/

// Called when req.query.type is normal
function RCallNormal(res) {
  var out = R("/home/ether/EthereumTracking/TFM/R/ND3.R")
    .data()
    .callSync();
  exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr) {
    res.render('response');
  });
}

// Called when req.query.type is betweenness
function RCallBetween(res) {
  var out = R("/home/ether/EthereumTracking/TFM/R/new2.R")
    .data()
    .callSync();
  exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr) {
    res.render('response');
  });
}



/*
----- Application logic -----
*/



// Get a random tx given a block number
function getRandomTx(blockNumber, res, ui, nodes, nOfBlocksToSearch, txList, type) {
  var respuesta = "";
  var txlength = 0;
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    var dbo = db.db("ethereumTracking");
    dbo.collection('Block').findOne({
      number: blockNumber
    }, function(err, result) {
      if (err != null) {
        console.error("The error output after searching for blockNumber " + blockNumber + " is: " + err);
        throw err;
      }
      console.log("The block got is " + JSON.stringify(result.number));
      if (result.transactions.length == 0) {
        console.log('There are no transactions in this block.');
        if (ui == true) {
          res.render('index', {
            title: 'Ethereum Tracking',
            notFound: "The transaction was not found, try with another one."
          });
        }
        db.close();
        return;
      }
      //console.log('Listado de transacciones del bloque ' + blockNumber + ':\n' + result.transactions);
      txlength = result.transactions.length;
      //console.log("The transactions number in this block is: " + txlength);
      var chosenTxNumber = Math.random() * (txlength - 1);
      var chosenTx = Math.round(chosenTxNumber);
      //      console.log('The transaction to track is: ' + result.transactions[chosenTx]);
      if (ui == false) {
        res.send(result.transactions[chosenTx].hash);
        db.close();
      } else {
        txList.push(result.transactions[chosenTx].hash);
        console.log("The nodeNumber is: " + nodes + ".\n The nOfBlocksToSearch is: " + nOfBlocksToSearch + ".\n The TX to search is (random): " + result.transactions[chosenTx].hash + ".\n");
        getTxInfo(result.transactions[chosenTx].hash, res, nodes, nOfBlocksToSearch, txList, type);
        db.close();
      }
    });
  });
};

// Finds the block number, sender an receiver wallets for the tx
function getTxInfo(tx, res, nodes, nOfBlocksToSearch, txList, type) {
  //  console.log("The transaction to track is: " + JSON.stringify(tx) + ".");
  var accToSearch = new Set();
  var startBlockNumber;
  var startBlockNumberRep;
  var bNumber;
  var accFrom = new Array();
  var accTo = new Array();
  var resultTx;
  console.log("Connecting to Mongo client...");
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    var dbo = db.db("ethereumTracking");
    dbo.collection('Block').findOne({
      "transactions.hash": tx
    }, function(err, result) {
      if (result == null) {
        console.error("The transaction " + tx + " was not found. The error is: " + err);
        res.render('index', {
          title: 'Ethereum Tracking',
          notFound: "The transaction " + tx + " was not found, try with another one."
        });
        db.close();
        return;
      }
      result.transactions.forEach(function(e) {
        if (e.hash == tx) {
          resultTx = e;
        }
      });
      if (!err && resultTx != null) {
        //        console.log("The tx got is " + JSON.stringify(result));
        //Variables globales wallets (array con las wallets) y txs (array con las transacciones), esta Ãºltima se ha aÃ±adido ya antes de
        //llamar a esta funciÃ³n. 
        accToSearch.add(resultTx.sender);
        accToSearch.add(resultTx.receiver);
        accFrom.push([resultTx.sender]);
        accTo.push([resultTx.receiver]);
        startBlockNumber = result.number;
        startBlockNumberRep = startBlockNumber;
        bNumber = result.number;
        console.log("Size of accToSearch at the beginning " + accToSearch.size);
        //db.close();
        if (nOfBlocksToSearch > 1) {
          console.log("Starting the iterations. nOfBlocksToSearch is " + nOfBlocksToSearch);
          db.close()
          getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);
        } else {
          printTrans(true, res, txList, type, accFrom, accTo, accToSearch);
          db.close();
        }
      } else {
        console.error("The transaction " + tx + " was not found. The error is: " + error);
        res.render('index', {
          title: 'Ethereum Tracking',
          notFound: "The transaction " + tx + " was not found, try with another one."
        });
        db.close();
      }
    });
  });
};

// Returns an ordered array with the given block and the next N-1
function getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, callback) {
  blocks = new Array(n);
  nOfBlocks = 0;
  var start = startBlockNumberRep;
  //var a = startBlockNumber+nOfBlocksToSearch;
  //console.log("MAX NUMBER IS: " + a);
  //var number = start;
  console.log("Starting the for loop...");
  console.log("Start is " + start + " and n is " + n);
  console.log("Opening new connection...");
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    for (var i = start; i < (start + n); i++) {
      var dbo = db.db("ethereumTracking");
      dbo.collection('Block').findOne({
        number: i
      }, function(err, result) {
        //      console.log("Found block " + result.number);
        if (!err && (result.number < (startBlockNumber + nOfBlocksToSearch))) {
          //Comprobamos que no estamos al final de la cadena
          if ((result != null) && (result.number < (startBlockNumber + nOfBlocksToSearch))) {
            nOfBlocks++;
            blocks[(result.number) - start] = result;
            //          console.log("The downloaded block number is " + result.number + " | " + parseInt(startBlockNumber + nOfBlocksToSearch) + " and nOfBlocks is " + nOfBlocks);
            if (nOfBlocks == n || ((nOfBlocks == nOfBlocksToSearch) && nOfBlocksToSearch < n) || (result.number == (startBlockNumber + nOfBlocksToSearch - 1) && (nOfBlocks == n))) {
              if (blocks[n - 1] != null) {
                console.log("The last block number in getNBlocks is " + blocks[n - 1].number);
              } else {
                console.log("The last block number in getNBlocks is undefined. Batch size may be bigger than number of iterations.");
              }
              startBlockNumberRep = startBlockNumberRep + nOfBlocks;
              db.close();
              callback(blocks, res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback);
            };
          };
        }
      });
    }
  });
};

// Returns an array with the related transactions
function processBlocks(blocks, res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback) {
  var nOfBlocks = [];
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i] != null && blocks[i].transactions != null) {
      //      console.log("Searching for transactions in block " + blocks[i].number);
      bNumber = blocks[i].number;
      blocks[i].transactions.forEach(function(e) {
        if (accToSearch.size > 0) {
          if (accToSearch.has(e.sender) && (accToSearch.size < (nodes))) {
            //txList[e.hash] = [e.from, e.to, e.blockNumber];
            txList.push(e.hash);
            //console.log("COMPARANDO []" + [e.to] + " con " + e.to);
            accToSearch.add([e.receiver]);
            accFrom.push([e.sender]);
            accTo.push([e.receiver]);
            //console.log("AccFrom is: " + accFrom.toString() + "\n and AccTo is: " + accTo.toString());
          };
        };
      });
      if (!((accToSearch.size < (nodes)) && ((bNumber + 1) < ((startBlockNumber + nOfBlocksToSearch))))) {
        printTrans(true, res, txList, type, accFrom, accTo, accToSearch);
        console.log("The number of blocks locked into is " + (bNumber - startBlockNumber + 1));
        console.log("The bNumber at the end is: " + bNumber);
        return;
      } else if (i == (blocks.length - 1)) {
        if ((accToSearch.size < (nodes)) && ((bNumber + 1) < ((startBlockNumber + nOfBlocksToSearch)))) {
          console.log("The blockNumber is " + bNumber);
          //console.log("The other variable to compare is " + (startBlockNumber + nOfBlocksToSearch));
          getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);
        }
      }
    };
  };
};

// Save accounts to CSV and call the R script.
function printTrans(pintar, res, txList, type, accFrom, accTo, accToSearch) {
  if (pintar) {
    //console.log("END. The transactions list is:\n"+Object.values(txList)+"\n"+ "And the group of related accounts:\n"+accToSearch.toString());
    console.log("There are " + txList.length + " transactions and " + accToSearch.size + " accounts");

    fromToCSV = csv(accFrom);
    toToCSV = csv(accTo);

    if (CSVWrite) {
      fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', fromToCSV, 'utf8', function(err) {
        if (err) {
          console.log('Some error occured - file either not saved or corrupted file saved.');
        } else {
          console.log('CSVfrom.csv saved!');
        }

        fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVto.csv', toToCSV, 'utf8', function(err) {
          if (err) {
            console.log('Some error occured - file either not saved or corrupted file saved.');
          } else {
            console.log('CSVto.csv saved!');
          }
          if (type == "normal") {
            console.log("Calling RCallNormal()");
            RCallNormal(res);
          } else if (type == "betweenness") {
            RCallBetween(res);
            console.log("Calling RCallBetween()");
          } else {
            console.log("Wrong input type.");
          }
        });
      });
    }
  }
}



module.exports.txTracking = function() {
  iterateTransactions();
}



function iterateTransactions() {
  console.log("Opening mongo client...");
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    var dbo = db.db("ethereumTracking");
    console.log("Client opened.");
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }
    //Customize
    var start = 5000000;
    var end = 6000000;
    var batchSize = 5000;
    var iterationCounter = 0;
    console.log("Before iterating...")
    txTracking(dbo, batchSize, start, end, iterationCounter, db);
  });
}

function txTracking(dbo, batchSize, start, end, iterationCounter, db) {
  console.log("Populate in batches called...");
  var counter = 0;
  var stop;
  var startBlock = start + iterationCounter;
  if ((batchSize) < (end - startBlock)) {
    stop = startBlock + batchSize;
  } else {
    stop = end;
  }
  console.log("Stop is " + stop);
  for (var i = startBlock; i < stop; i++) {
    web3.eth.getBlock(i, true, function(error, result) {
      if (error != null) {
        console.error("An error ocurred while getting the block. " + error);
        throw error;
      }
      console.log("Processing the block: " + result.number);
      if (result != null) {
        var txList = new Array();
        if (result.transactions.length > 0) {
          var blockLength = result.transactions.length;
          var txCounter = 0;
          result.transactions.forEach(function(e) {
            var tx = {};
            console.log("The tx is: " + JSON.stringify(e));
            tx.hash = e.hash;
            tx.sender = e.from;
            tx.receiver = e.to;
            tx.amount = (e.value) / 1000000000000000000;
            tx.blockNumber = result.number;

            dbo.collection('Transaction').updateOne({
              hash: e.hash
            }, {
              $set: tx
            }, {
              upsert: true
            }, function(err, result) {
              if (err != null) {
                console.error("The error output after adding the document to the database is " + err);
                throw err;
              }
              txCounter++;
              if (blockLength == txCounter) {
                counter++;
              }
              if (counter == (stop - startBlock)) {
                iterationCounter += counter;
                console.log("Iteration counter is " + iterationCounter);
                if (iterationCounter == (end - start)) {
                  console.log("Closing client.");
                  db.close();
                  return;
                } else {
                  console.log("Calling PopulateInBatches again..." + "\n");
                  txTracking(dbo, batchSize, start, end, iterationCounter, db);
                }
              }
            });
          });
        } else {
          console.log("There are not transactions in this block.");
        }
      }
    });
  }
}



module.exports.toMongo = function() {
  populateDatabase();
}

function populateDatabase() {
  console.log("Opening mongo client...");
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    var dbo = db.db("ethereumTracking");
    console.log("Client opened.");
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }
    //Customize
    var start = 5300000;
    var end = 6000000;
    var batchSize = 2000;
    var iterationCounter = 0;
    console.log("Before iterating...")
    populateInBatches(dbo, batchSize, start, end, iterationCounter, db);
  });
}

function populateInBatches(dbo, batchSize, start, end, iterationCounter, db) {
  console.log("Populate in batches called...");
  var counter = 0;
  var stop;
  var startBlock = start + iterationCounter;
  if ((batchSize) < (end - startBlock)) {
    stop = startBlock + batchSize;
  } else {
    stop = end;
  }
  console.log("Stop is " + stop);
  for (var i = startBlock; i < stop; i++) {
    web3.eth.getBlock(i, true, function(error, result) {
      if (error != null) {
        console.error("An error ocurred while getting the block. " + error);
        throw error;
      }
      console.log("Processing the block: " + result.number);
      if (result != null) {
        var txList = new Array();
        if (result.transactions.length > 0) {
          result.transactions.forEach(function(e) {
            var tx = {};
            console.log("The tx is: " + JSON.stringify(e));
            tx.hash = e.hash;
            tx.sender = e.from;
            tx.receiver = e.to;
            tx.amount = (e.value) / 1000000000000000000;
            txList.push(tx);
          });
        } else {
          console.log("There are not transactions in this block.");
        }

        var toInsert = {}
        toInsert.number = result.number;
        toInsert.transactions = txList;
        toInsert.miner = result.miner;

        console.log("The doc to insert is: " + JSON.stringify(toInsert));

        dbo.collection('Block').updateOne({
          number: toInsert.number
        }, {
          $set: toInsert
        }, {
          upsert: true
        }, function(err, result) {
          if (err != null) {
            console.error("The error output after adding the document to the database is " + err);
            throw err;
          }
          counter++;
          if (counter == (stop - startBlock)) {
            iterationCounter += counter;
            console.log("Iteration counter is " + iterationCounter);
            if (iterationCounter == (end - start)) {
              console.log("Closing client.");
              db.close();
              return;
            } else {
              console.log("Calling PopulateInBatches again..." + "\n");
              populateInBatches(dbo, batchSize, start, end, iterationCounter, db);
            }
          }
        });
      }
    });
  }
}



// New implementation pseudocode
/*
--- Populating MongoDB ---
  - Go to start block (in this case, block #5.000.000)
  - For every tx every 2.000 blocks: 
      //SENDERS - which will add elements to each wallet receivers field
      - If not exists in dict -> add senders wallet as a new key in the wallets dictionary
      - Now that it is created for sure -> add the transaction hash to its txs record (array of dicts) as a new key
        - Value of each dict's element: block number, receiver's wallet, ether sent
        - Deduct ether sent from total ether 
      //RECEIVERS - which will add elements to each wallet senders field
      - If not exists in dict -> add recivers wallet as a new key in the wallets dict
      - Now that is created for sure -> add the tx hash to its txs record
        - Value of each dict's element: block number, receiver's wallet, ether received
        - Add ether sent to total ether 

  - If already iterated over a block
      - Save elements 
        - update records in Mongo, iterating over dicts (senders and receivers) keys
      -  Reinitialize dictionaries and start again.
*/

module.exports.walletsTracking = function() {
  trackWallets();
}

function trackWallets() {
  console.log("Opening mongo client...");
  MongoClient.connect("mongodb://localhost:27017", function(err, db) {
    var dbo = db.db("ethereumTracking");
    console.log("Client opened.");
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }
    //Customize
    var start = 5000000;
    var end = 5010000;
    var batchSize = 10000;
    // Blocks total counter
    var iterationCounter = 0;
    console.log("Before iterating...")
    populateInBatchesForWalletsTracking(dbo, batchSize, start, end, iterationCounter, db);
  });
}

function populateInBatchesForWalletsTracking(dbo, batchSize, start, end, iterationCounter, db) {
  console.log("Populate in batches for wallets tracking called...");
  //Blocks counter on this batch
  var counter = 0;
  var stop;
  var startBlock = start + iterationCounter;
  if ((batchSize) < (end - startBlock)) {
    stop = startBlock + batchSize;
  } else {
    stop = end;
  }
  /*
  --- Data structure ---
  Wallet:
   - id
   - amountSent
   - amountReceived
   - receivers: object
      - txHash
      - blockNumber
      - receiver
      - amount
   - senders: object
      - txHash
      - blockNumber
      - sender
      - amount
  */
  var wallets = [];
  var wallets_index = new Set();
  console.log("Stop is " + stop);

  for (var j = startBlock; j < stop; j++) {
    web3.eth.getBlock(j, true, function(error, result) {
      if (error != null) {
        console.error("An error ocurred while getting the block. " + error);
        throw error;
      }

      console.log("Processing the block: " + result.number);
      if (result != null) {
        if (result.transactions.length > 0) {
          result.transactions.forEach(function(e) {
            currentFrom = {};
            currentTo = {};

            // for the other ones, we need to check whether that wallet is already in the the wallets array
            var indexFrom = -1;
            var indexTo = -1;
            //console.log("From is " + e.from + " and to is " + e.to + " and txHash is " + e.hash);
            var fromHash = hash(e.from);
            var toHash = "";
            if (e.to != null) {
              // if it is the creation of a contract it can be null
              var toHash = hash(e.to);
            }

            if (wallets[fromHash] != null) {
              if (wallets[fromHash].id == e.from) {
                indexFrom = fromHash;
              }
            }
            if (wallets[toHash] != null) {
              if (wallets[toHash].id == e.to) {
                indexTo = toHash;
              }
            }

            if (indexFrom != -1) {
              //console.log("Already in wallets");
              currentFrom = wallets[indexFrom];
              currentFrom.etherSent += ((e.value) / 1000000000000000000);
              currentFrom.receivers.push({
                txHash: e.hash,
                blockNumber: result.number,
                receiver: e.to,
                amount: ((e.value) / 1000000000000000000)
              });
              wallets[indexFrom] = currentFrom;
            } else {
              //console.log("Not already in wallets");
              currentFrom.id = e.from;
              currentFrom.etherSent = ((e.value) / 1000000000000000000);
              currentFrom.etherReceived = 0;
              currentFrom.receivers = [{
                txHash: e.hash,
                blockNumber: result.number,
                receiver: e.to,
                amount: ((e.value) / 1000000000000000000)
              }];
              currentFrom.senders = [];
              wallets[fromHash] = currentFrom;
              wallets_index.add(fromHash);
            }
            // information to update the senders field
            if (indexTo != -1) {
              //console.log("Already in wallets");
              currentTo = wallets[indexTo];
              currentTo.etherReceived += ((e.value) / 1000000000000000000);
              currentTo.senders.push({
                txHash: e.hash,
                blockNumber: result.number,
                sender: e.from,
                amount: ((e.value) / 1000000000000000000)
              });
              wallets[indexTo] = currentTo;
            } else {
              //console.log("Not already in wallets");
              currentTo.id = e.to;
              currentTo.etherSent = 0;
              currentTo.etherReceived = ((e.value) / 1000000000000000000);
              currentTo.receivers = [];
              currentTo.senders = [{
                txHash: e.hash,
                blockNumber: result.number,
                sender: e.from,
                amount: ((e.value) / 1000000000000000000)
              }];
              wallets[toHash] = currentTo;
              wallets_index.add(toHash);
            }

          });
          counter++;
          if (counter % 100 == 0) {
            console.log("Counter is " + counter);
          }

          if (counter == (stop - startBlock)) {
            var wallets_index_array = Array.from(wallets_index);
            var wallets_index_length = wallets_index_array.length;
            // Wallets counter on this batch
            var counter_iter = 0;
            console.log("Updating MongoDB... Wallets length is " + wallets_index_length + ". Date is " + new Date());
            updateWalletInMongo(dbo, batchSize, start, end, iterationCounter, db, counter, wallets_index_array, counter_iter, wallets, wallets_index_length);
          }
        } else {
          console.log("There are not transactions in this block.");
        }
      }
    });
  }
}


function updateWalletInMongo(dbo, batchSize, start, end, iterationCounter, db, counter, wallets_index_array, counter_iter, wallets, wallets_index_length) {
  // If the wallet is already stored, get its current value, to update the ether sent and received and
  // its receivers and senders arrays
  var i_i = wallets_index_array[0];
  //var wallet_id = wallets[i_i].id;
  //console.log("Wallets id at index " + i_i + " is " + wallets[i_i].id + ". Wallets size is " + wallets.length);
  dbo.collection('Wallet').updateOne({
    id: wallets[i_i].id
  }, {
    $set: {
      id: wallets[i_i].id
    },
    $push: {
      receivers: {
        $each: wallets[i_i].receivers
      },
      senders: {
        $each: wallets[i_i].senders
      }
    },
    $inc: {
      etherSent: wallets[i_i].etherSent,
      etherReceived: wallets[i_i].etherReceived
    }
  }, {
    upsert: true
  }, function(err, result) {
    if (err != null) {
      console.error("The error output after updating the document in the database is " + err);
      throw err;
    }
    console.log("Doing stuff in MongoDB... Date is " + new Date());
    counter_iter++;
    console.log("Counter_iter is " + counter_iter + " and wallets length " + wallets_index_length);
    if (counter_iter == wallets_index_length) {
      iterationCounter += counter;
      console.log("Iteration counter is " + iterationCounter + " and end-start is " + (end - start));
      console.log("Counter is " + counter);
      if (iterationCounter == (end - start)) {
        console.log("Closing client.");
        db.close();
        return;
      } else {
        console.log("Calling populateInBatchesForWalletsTracking again..." + "\n");
        populateInBatchesForWalletsTracking(dbo, batchSize, start, end, iterationCounter, db);
      }
    } else {
      wallets_index_array.splice(0, 1);
      updateWalletInMongo(dbo, batchSize, start, end, iterationCounter, db, counter, wallets_index_array, counter_iter, wallets, wallets_index_length)
    }
  });
}


// --- CASSANDRA START  ---



module.exports.walletsTrackingCassandra = function() {
  trackWalletsCassandra();
}

function trackWalletsCassandra() {
  console.log("Opening Cassandra client...");
  var dbo = new cassandra.Client({
    contactPoints: ['127.0.0.1:9042'],
    keyspace: 'ethereumtracking'
  });
  dbo.connect(function(err) {
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }

    //Customize
    var start = 5012500;
    var end = 5100000;
    var batchSize = 15000;
    // Blocks total counter
    var iterationCounter = 0;
    console.log("Before iterating...")
    populateInBatchesForWalletsTrackingCassandra(dbo, batchSize, start, end, iterationCounter);
  });
}

function populateInBatchesForWalletsTrackingCassandra(dbo, batchSize, start, end, iterationCounter) {
  console.log("Populate in batches for wallets tracking called...");
  //Blocks counter on this batch
  var counter = 0;
  var stop;
  var startBlock = start + iterationCounter;
  if ((batchSize) < (end - startBlock)) {
    stop = startBlock + batchSize;
  } else {
    stop = end;
  }

  var wallets = [];
  var wallets_index = new Set();
  console.log("Stop is " + stop);

  for (var j = startBlock; j < stop; j++) {
    web3.eth.getBlock(j, true, function(error, result) {
      if (error != null) {
        console.error("An error ocurred while getting the block. " + error);
        throw error;
      }

      //console.log("Processing the block: " + result.number);
      if (result != null) {
        if (result.transactions.length > 0) {
          result.transactions.forEach(function(e) {
            currentFrom = {};
            currentTo = {};

            // for the other ones, we need to check whether that wallet is already in the the wallets array
            var indexFrom = -1;
            var indexTo = -1;
            //console.log("From is " + e.from + " and to is " + e.to + " and txHash is " + e.hash);
            var fromHash = hash(e.from);
            var toHash = "";
            if (e.to != null) {
              // if it is the creation of a contract it can be null
              var toHash = hash(e.to);
            }

            if (wallets[fromHash] != null) {
              if (wallets[fromHash].id == e.from) {
                indexFrom = fromHash;
              }
            }
            if (wallets[toHash] != null) {
              if (wallets[toHash].id == e.to) {
                indexTo = toHash;
              }
            }

            if (indexFrom != -1) {
              //console.log("Already in wallets");
              currentFrom = wallets[indexFrom];
              //currentFrom.etherSent += ((e.value) / 1000000000000000000);
              currentFrom.receivers.push({
                amount: ((e.value) / 1000000000000000000),
                blocknumber: result.number,
                txhash: e.hash,
                wallet: e.to
              });
              wallets[indexFrom] = currentFrom;
            } else {
              //console.log("Not already in wallets");
              currentFrom.id = e.from;
              //currentFrom.etherSent = ((e.value) / 1000000000000000000);
              //currentFrom.etherReceived = 0;
              currentFrom.receivers = [{
                amount: ((e.value) / 1000000000000000000),
                blocknumber: result.number,
                txhash: e.hash,
                wallet: e.to
              }];
              currentFrom.senders = [];
              wallets[fromHash] = currentFrom;
              wallets_index.add(fromHash);
            }
            // information to update the senders field
            if (indexTo != -1) {
              //console.log("Already in wallets");
              currentTo = wallets[indexTo];
              //currentTo.etherReceived += ((e.value) / 1000000000000000000);
              currentTo.senders.push({
                amount: ((e.value) / 1000000000000000000),
                blocknumber: result.number,
                txhash: e.hash,
                wallet: e.from,
              });
              wallets[indexTo] = currentTo;
            } else {
              //console.log("Not already in wallets");
              currentTo.id = e.to;
              //currentTo.etherSent = 0;
              //currentTo.etherReceived = ((e.value) / 1000000000000000000);
              currentTo.receivers = [];
              currentTo.senders = [{
                amount: ((e.value) / 1000000000000000000),
                blocknumber: result.number,
                txhash: e.hash,
                wallet: e.from,
              }];
              wallets[toHash] = currentTo;
              wallets_index.add(toHash);
            }
          });
        } else {
          console.log("There are not transactions in this block.");
        }

        counter++;
        if (counter % 100 == 0) {
          console.log("Counter is " + counter);
        }

        if (counter == (stop - startBlock)) {
          var wallets_index_array = Array.from(wallets_index);
          var wallets_index_length = wallets_index_array.length;
          // Wallets counter on this batch
          var counter_iter = 0;
          console.log("Updating Cassandra... Wallets length is " + wallets_index_length + ". Date is " + new Date());
          updateWalletInCassandra(dbo, batchSize, start, end, iterationCounter, counter, wallets_index_array, counter_iter, wallets, wallets_index_length);
        }

      }
    });
  }
}


function updateWalletInCassandra(dbo, batchSize, start, end, iterationCounter, counter, wallets_index_array, counter_iter, wallets, wallets_index_length) {
  // If the wallet is already stored, get its current value, to update the ether sent and received and
  // its receivers and senders arrays
  var i_i = wallets_index_array[0];

  var query = 'UPDATE wallets SET receivers=receivers+?, senders=senders+? WHERE id=?';
  var params = {
    receivers: wallets[i_i].receivers,
    senders: wallets[i_i].senders,
    id: wallets[i_i].id
  };

  console.log("Wallet senders is " + JSON.stringify(wallets[i_i].senders));
  console.log("Wallet is " + (wallets[i_i].id));

  dbo.execute(query, params, {
      prepare: true
    },
    function(err, result) {
      if (err != null) {
        console.error("The error output after updating the document in the database is " + err);
        //throw err;
      }
      console.log("Doing stuff in Cassandra... Date is " + new Date());
      counter_iter++;
      console.log("Counter_iter is " + counter_iter + " and wallets length " + wallets_index_length);
      if (counter_iter == wallets_index_length) {
        iterationCounter += counter;
        console.log("Iteration counter is " + iterationCounter + " and end-start is " + (end - start));
        console.log("Counter is " + counter);
        if (iterationCounter == (end - start)) {
          console.log("Closing client.");
          dbo.shutdown();
          return;
        } else {
          console.log("Calling populateInBatchesForWalletsTracking again..." + "\n");
          populateInBatchesForWalletsTrackingCassandra(dbo, batchSize, start, end, iterationCounter);
        }
      } else {
        wallets_index_array.splice(0, 1);
        updateWalletInCassandra(dbo, batchSize, start, end, iterationCounter, counter, wallets_index_array, counter_iter, wallets, wallets_index_length)
      }

    });;


}

// --- CASSANDRA END ---



/*
--- Querying ---
  - Given a wallet:  (if we want to do the ordered thing, better use the current implementation)
    - Find it and get its receivers
    - For every receiver, 2 options: (end conditions: number of nodes OR tree level)
          - If preserving temporal information - get its receivers with block number > than its number with the previous node in the tree
          - If not preserving temporal information - just get all of them 
    - Add all the info (tuples: sender, receiver, txHash, ether...) to a CSV (maybe in batches, if there are memory issues)

*/

//Choose a random wallet from a stored block 
function getRandomWallet(chosenBlock, res, nodes, levels, type) {
  var respuesta = "";
  var txLength = 0;

  web3.eth.getBlock(chosenBlock, true, function(error, result) {
    if (error != null) {
      console.error("An error ocurred while getting the block. " + error);
      throw error;
    }
    if (result != null) {
      if (result.transactions.length > 0) {
        txLength = result.transactions.length;
        var chosenTxNumber = Math.random() * (txLength - 1);
        var chosenTx = Math.round(chosenTxNumber);
        var wallet = result.transactions[chosenTx].from;
        console.log("First wallet is " + wallet);
        getWalletTreeFromCassandra(res, wallet, nodes, levels, type);
      }
    }
  });
};

// Get the graph for this wallet
router.get('/getWalletTree', function(req, res) {
  var nodes = 250;
  //TODO implement level threshold
  //var levels = 3;
  var levels = "";
  var txList = [];
  var type = req.query.type;

  var currentNumberOfBlocks = 400000;
  var chosenBlockNumber = Math.random() * (currentNumberOfBlocks);
  var chosenBlock = Math.round(chosenBlockNumber);
  chosenBlock = 5000000 + chosenBlock;

  if (req.query.nodeNum != "" && req.query.nodeNum != null && req.query.nodeNum != undefined) {
    nodes = req.query.nodeNum;
  }

  // Regex worth it?
  //TODO Change to wallet
  var wallet = req.query.wallet;
  //resGlobal = res;
  if (wallet == "" || wallet == null || wallet == undefined) {
    getRandomWallet(chosenBlock, res, nodes, levels, type);
  } else {
    getWalletTreeFromCassandra(res, wallet, nodes, levels, type);
  }
});

function getWalletTreeFromCassandra(res, wallet, nodes, levels, type) {
  //var nodes = 300;
  //var wallet = "0xF5bEC430576fF1b82e44DDB5a1C93F6F9d0884f3";
  var dbo = new cassandra.Client({
    contactPoints: ['127.0.0.1:9042'],
    keyspace: 'ethereumtracking'
  });
  //type = "normal"
  // First level
  var query = 'SELECT receivers FROM wallets WHERE id=?';
  var params = {
    id: wallet
  };

  var accFrom = new Array();
  var accTo = new Array();
  var accList = new Set();
  dbo.connect(function(err) {
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }
    accList.add(wallet);
    getReceiversForWallet(accList, res, type, accFrom, accTo, nodes, dbo);
    /*
    dbo.execute(query, params, {
        prepare: true
      },
      function(err, result) {
        if (err != null) {
          console.log("There was an error querying the DDBB.");
        }
        var size = result.rows[0].receivers.length;
        console.log("Size is " + size);
        // Max nodes number reached
        if (size >= nodes) {
          size = nodes;
          for (var i = 0; i < size; i++) {
            accFrom.push([wallet]);
            accTo.push([result.rows[0].receivers[i].wallet]);
          }
          //console.log("From is \n" + accFrom);
          //console.log("To is \n" + accTo);
          console.log("Nodes limit achieved. Printing and exiting");
          //call print and return
          printTransCassandra(res, type, accFrom, accTo);
          return;
        } else {
          for (var i = 0; i < size; i++) {
            accFrom.push([wallet]);
            accTo.push([result.rows[0].receivers[i].wallet]);
            accList.add([result.rows[0].receivers[i].wallet]);
          }

          // Iterate until there are no more wallets or we reach a limit (either nodes or levels).
          //
          // The wallets shown if any limit is reached are randomly chosen (the ones that get a faster response 
          // from Cassandra).
          while ((accList.values().next().value != null) && (accList.values().next().value != undefined)) {
            console.log("AccountList size is " + accList.size + " in the beginning of this iteration.");
            var query = 'SELECT receivers FROM wallets WHERE id=?';
            var currentWallet = accList.values().next().value;
            var params = {
              id: currentWallet
            };
            dbo.execute(query, params, {
                prepare: true
              },
              function(err, result2) {
                if (err != null) {
                  console.log("There was an error querying the DDBB.");
                }
                var currentWalletReceiversLength = result2.rows[0].receivers.length;
                for (var i = 0; i < currentWalletReceiversLength; i++) {
                  if (accFrom.length >= nodes) {
                    console.log("Nodes limit achieved. Printing and exiting");
                    //console.log("From is \n" + accForm);
                    //console.log("To is \n" + accTo);
                    printTransCassandra(res, type, accFrom, accTo);
                    return;
                  }
                  accFrom.push([currentWallet]);
                  accTo.push([result2.rows[0].receivers[i].wallet]);
                  accList.add(result2.rows[0].receivers[i].wallet);
                }
              });


          }
        }

      });
    */
  });
}



function getReceiversForWallet(accList, res, type, accFrom, accTo, nodes, dbo) {
  if (accList.size < 1) {
    //console.log("From is \n" + accForm);
    //console.log("To is \n" + accTo);
    console.log("Nodes limit achieved. Printing and exiting");
    printTransCassandra(res, type, accFrom, accTo);
    return;
  } else {
    var query = 'SELECT receivers FROM wallets WHERE id=?';
    // Get the next one
    var wallet = accList.values().next().value;
    console.log("Next wallet from set is " + wallet + ".\n");
    var params = {
      id: wallet
    };
    dbo.execute(query, params, {
        prepare: true
      },
      function(err, result) {
        if (err != null) {
          console.log("There was an error querying the DDBB.");
        }
        if (result == null || result.rows[0].receivers == null) {
          accList.delete(wallet);
          getReceiversForWallet(accList, res, type, accFrom, accTo, nodes, dbo);
        } else {
          // Receivers size for this wallet
          var size = result.rows[0].receivers.length;
          //console.log("Size is " + size);
          // Number of remaining nodes to add 
          var remainingSize = nodes - accFrom.length;
          // Max nodes number reached in this iteration
          if (size >= remainingSize) {
            size = remainingSize;
            for (var i = 0; i < size; i++) {
              accFrom.push([wallet]);
              accTo.push([result.rows[0].receivers[i].wallet]);
            }
            console.log("Nodes limit achieved. Printing and exiting");
            printTransCassandra(res, type, accFrom, accTo);
            return;
          } else {
            for (var i = 0; i < size; i++) {
              accFrom.push([wallet]);
              accTo.push([result.rows[0].receivers[i].wallet]);
              accList.add(result.rows[0].receivers[i].wallet);
            }
            accList.delete(wallet);
            getReceiversForWallet(accList, res, type, accFrom, accTo, nodes, dbo);
          }
        }
      });


  }
}


// Save accounts to CSV and call the R script.
function printTransCassandra(res, type, accFrom, accTo) {
  fromToCSV = csv(accFrom);
  toToCSV = csv(accTo);
  if (CSVWrite) {
    fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', fromToCSV, 'utf8', function(err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } else {
        console.log('CSVfrom.csv saved!');
      }

      fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVto.csv', toToCSV, 'utf8', function(err) {
        if (err) {
          console.log('Some error occured - file either not saved or corrupted file saved.');
        } else {
          console.log('CSVto.csv saved!');
        }
        if (type == "normal") {
          console.log("Calling RCallNormal()");
          RCallNormal(res);
        } else if (type == "betweenness") {
          RCallBetween(res);
          console.log("Calling RCallBetween()");
        } else {
          console.log("Wrong input type.");
        }
      });
    });
  }

}



/*
----- Functions below were created just to test a few things. Only useful for debugging
*/

// Testo to store an array as .csv
router.get('/CSVTest', function(req, res) {
  a = new Array();
  a.push(['0x588C9C56b019F4DBd7a0497F632981599BFf61f6']);
  console.log(a);

  aToCSV = csv(a);
  var fs = require('fs');
  fs.writeFile('/home/ether/EthereumTracking/TFM/CSV/CSV.csv', aToCSV, 'utf8', function(err) {
    if (err) {
      console.error('Some error occured - file either not saved or corrupted file saved.', err);
    } else {
      console.log('It\'s saved!');
    }
  });
});