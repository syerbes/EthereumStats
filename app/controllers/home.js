var Web3 = require('web3');
var R = require("r-script");
var csv = require("array-to-csv");
var fs = require('fs');
var net = require('net');
var exec = require('child_process').exec;
var MongoClient = require('mongodb').MongoClient;
var hash = require('string-hash'); // number between 0 and 4294967295, inclusive
var cassandra = require('cassandra-driver');
const parse = require('csv-parse/lib/sync');

// Batch size
var n = 2000;
// Whether to write to CSV
var CSVWrite = true;
// Mongo uri
const MONGO_URI = "mongodb://127.0.0.1:27017";

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
function RCallNormal(res, accounts) {
  var out = R("/home/ether/EthereumTracking/TFM/R/betweenness.R")
    .data()
    .callSync();
  generateJSON(res, accounts, "normal");
  //exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr) {
  //  res.render('response');
  //});
  console.log("rendering...");
  res.render('response');
}

// Called when req.query.type is betweenness
function RCallBetween(res, accounts) {
  var out = R("/home/ether/EthereumTracking/TFM/R/betweenness.R")
    .data()
    .callSync();
  generateJSON(res, accounts, "betweenness");
  //exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr) {
  //  res.render('response');
  //});
  console.log("rendering...");
  res.render('response');
}



/*
----- Application logic -----
*/


// --- Start of sequential and real-time tracking --- 

// Get a random tx given a block number
function getRandomTx(blockNumber, res, ui, nodes, nOfBlocksToSearch, txList, type) {
  var respuesta = "";
  var txlength = 0;
  web3.eth.getBlock(blockNumber, false, function(error, result) {
    if (!error && result != null) {
      if (result.transactions.length == 0) {
        console.log('There are no transactions in this block.');
        if (ui == true) {
          res.render('index', {
            title: 'Ethereum Tracking',
            notFound: "The transaction was not found, try with another one."
          });
        }
        return;
      }
      //console.log('Listado de transacciones del bloque ' + blockNumber + ':\n' + result.transactions);
      txlength = result.transactions.length;
      //console.log("The transactions number in this block is: " + txlength);
      var chosenTxNumber = Math.random() * (txlength - 1);
      var chosenTx = Math.round(chosenTxNumber);
      console.log('The transaction to track is: ' + result.transactions[chosenTx]);
      if (ui == false) {
        res.send(result.transactions[chosenTx]);
      } else {
        txList.push(result.transactions[chosenTx]);
        console.log("The nodeNumber is: " + nodes + ".\n The nOfBlocksToSearch is: " + nOfBlocksToSearch + ".\n The TX to search is (random): " + result.transactions[chosenTx] + ".\n");
        getTxInfo(result.transactions[chosenTx], res, nodes, nOfBlocksToSearch, txList, type);
      }
    } else {
      if (result == null) {
        console.log('The block was not created.');
        if (ui == true) {
          res.render('index', {
            title: 'Ethereum Tracking',
            notFound: "The transaction was not found, try with another one."
          });
        }
        return;
      }
      console.log('An error occured: ', error);
    };
  });
};

// Finds the block number, sender an receiver wallets for the tx
function getTxInfo(tx, res, nodes, nOfBlocksToSearch, txList, type) {
  console.log("The transaction to track is: " + tx + ".");
  var accToSearch = new Set();
  var startBlockNumber;
  var startBlockNumberRep;
  var bNumber;
  var accounts = new Array();
  accounts.push(["source", "target", "weight"]);

  web3.eth.getTransaction(tx, function(error, result) {
    if (!error) {
      //Variables globales wallets (array con las wallets) y txs (array con las transacciones), esta última se ha añadido ya antes de
      //llamar a esta función. 
      accToSearch.add(result.from);
      accToSearch.add(result.to);
      accounts.push([result.from, result.to, 1]);
      startBlockNumber = result.blockNumber;
      startBlockNumberRep = startBlockNumber;
      bNumber = result.blockNumber;
      console.log("Size of accToSearch at the beginning " + accToSearch.size);
      getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accounts, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);
    } else {
      console.error("The transaction " + tx + " was not found. The error is: " + error);
      res.render('index', {
        title: 'Ethereum Tracking',
        notFound: "The transaction " + tx + " was not found, try with another one."
      });
    }
  });

};

// Returns an ordered array with the given block and the next N-1
function getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accounts, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, callback) {
  blocks = new Array(n);
  nOfBlocks = 0;
  var start = startBlockNumberRep;
  //var a = startBlockNumber+nOfBlocksToSearch;
  //console.log("MAX NUMBER IS: " + a);
  //var number = start;
  for (var i = start; i < (start + n); i++) {
    web3.eth.getBlock(i, true, function(error, result) {
      //Comprobamos que no estamos al final de la cadena
      if ((result != null) && (result.number < (startBlockNumber + nOfBlocksToSearch))) {
        nOfBlocks++;
        blocks[(result.number) - start] = result;
        console.log("The downloaded block number is " + result.number + " | " + parseInt(startBlockNumber + nOfBlocksToSearch) + " and nOfBlocks is " + nOfBlocks);
        if (nOfBlocks == n || ((nOfBlocks == nOfBlocksToSearch) && nOfBlocksToSearch < n) || (result.number == (startBlockNumber + nOfBlocksToSearch - 1) && (nOfBlocks == n))) {
          if (blocks[n - 1] != null) {
            console.log("The last block number in getNBlocks is " + blocks[n - 1].number);
          } else {
            console.log("The last block number in getNBlocks is undefined. Batch size may be bigger than number of iterations.");
          }
          startBlockNumberRep = startBlockNumberRep + nOfBlocks;
          callback(blocks, res, nodes, nOfBlocksToSearch, txList, type, accounts, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback);
        };
      };
    });
  };
};
// Returns an array with the related transactions
function processBlocks(blocks, res, nodes, nOfBlocksToSearch, txList, type, accounts, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback) {
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
            accounts.push([e.sender, e.receiver, 1, ((e.value) / 1000000000000000000), e.hash]);
            //console.log("AccFrom is: " + accFrom.toString() + "\n and AccTo is: " + accTo.toString());
          };
        };
      });
      if (!((accToSearch.size < (nodes)) && ((bNumber + 1) < ((startBlockNumber + nOfBlocksToSearch))))) {
        printTrans(true, res, txList, type, accounts, accToSearch);
        console.log("The number of blocks looked into is " + (bNumber - startBlockNumber + 1));
        console.log("The bNumber at the end is: " + bNumber);
        return;
      } else if (i == (blocks.length - 1)) {
        if ((accToSearch.size < (nodes)) && ((bNumber + 1) < ((startBlockNumber + nOfBlocksToSearch)))) {
          console.log("The blockNumber is " + bNumber);
          //console.log("The other variable to compare is " + (startBlockNumber + nOfBlocksToSearch));
          getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accounts, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);
        }
      }
    };
  };
};

// Save accounts to CSV and call the R script.
function printTrans(pintar, res, txList, type, accounts, accToSearch) {
  if (pintar) {
    //console.log("END. The transactions list is:\n"+Object.values(txList)+"\n"+ "And the group of related accounts:\n"+accToSearch.toString());
    //console.log("There are " + txList.length + " transactions and " + accToSearch.size + " accounts");
    accountsVisualization = groupPairsOfNodesForVisualization(accounts);
    accounts = groupPairsOfNodes(accounts);
    accountsToCSV = csv(accounts);
    try {
      fs.writeFileSync('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', accountsToCSV, 'utf8');
    } catch (error) {
      console.log("Error while writing CSVfrom.csv file.");
      //TODO RENDER ERROR CODE

      return;
    }
    if (type == "normal") {
      //console.log("Calling RCallNormal()");
      RCallNormal(res, accountsVisualization);
    } else if (type == "betweenness") {
      RCallBetween(res, accountsVisualization);
      //console.log("Calling RCallBetween()");
    } else {
      console.log("Wrong input type.");
    }

    /*
    if (CSVWrite) {
      fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', accountsToCSV, 'utf8', function(err) {
        if (err) {
          console.log('Some error occured - file either not saved or corrupted file saved.');
        } else {
          console.log('CSVfrom.csv saved!');
        }
        // Type of graph to compute
        if (type == "normal") {
          console.log("Calling RCallNormal()");
          RCallNormal(res, accountsVisualization);
        } else if (type == "betweenness") {
          RCallBetween(res, accountsVisualization);
          console.log("Calling RCallBetween()");
        } else {
          console.log("Wrong input type.");
        }
      });
    }
    */
  }
}

// --- End of sequential and real-time tracking ---


// --- Populate Mongo ---

//


function getWalletTreeFromMongo(res, wallet, nodes, levels, type) {


  //var nodes = 300;
  //var wallet = "0xF5bEC430576fF1b82e44DDB5a1C93F6F9d0884f3";
  MongoClient.connect(MONGO_URI, function(err, db) {
    console.log("Client opened.");
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      throw err;
    }

    var accounts = new Array();
    accounts.push(["source", "target", "weight", "ether", "hash"]);
    var accList = new Set();
    accList.add(wallet);
    var dbo = db.db('ethereumTracking');
    getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db);
  });

}

async function getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db) {
  if (accList.size < 1) {
    //console.log("From is \n" + accForm);
    //console.log("To is \n" + accTo);
    console.log("Nodes limit achieved. Printing and exiting");
    printTransCassandra(res, type, accounts);
    return db.close();
  } else {

    // Get the next one
    var wallet = accList.values().next().value;
    var query = {
      "sender": wallet
    };
    console.log("Next wallet from set is " + wallet + ".\n");



    var cursor = dbo.collection('Transaction').find(query);
    console.log("Got cursor");

    var result = new Array();


    while (await cursor.hasNext()) {
      console.log("Siguiente del cursor");
      var doc = await cursor.next();
      //console.log("Doc is " + JSON.stringify(doc));
      result.push([doc])
    }

    cursor.close();

    if (result.length > 0) {
      // Receivers size for this wallet
      var size = result.length;
      console.log(size + " receivers for this wallet");
      console.log("Size is " + size + " for wallet" + wallet);
      // Number of remaining nodes to add 
      var remainingSize = nodes - accounts.length;


      // Max nodes number reached in this iteration
      if (size >= remainingSize) {
        size = remainingSize;
        console.log("Size after updating to the remaining size is : " + size);
        for (var i = 0; i < size; i++) {
          //console.log(result.rows[0].receivers[i]);
          var receiver = result[0].wallet;
          var amount = result[0].amount;
          var hash = result[0].hash;
          //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
          if (wallet != null && wallet != "" && wallet != undefined &&
            receiver != null && receiver != "" && receiver != undefined &&
            hash != null && hash != "" && hash != undefined) {
            //console.log("adding wallet\n");
            accounts.push([wallet, receiver, 1, amount, hash]);
          }

        }
        console.log("Nodes limit achieved. Printing and exiting");
        //console.log("Accounts is " + accounts);
        printTransCassandra(res, type, accounts);
        return db.close();
      } else {
        for (var i = 0; i < size; i++) {
          //console.log(result.rows[0].receivers[i]);
          var receiver = result[0].receiver;
          var amount = result[0].amount;
          var hash = result[0].hash;
          //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
          if (wallet != null && wallet != "" && wallet != undefined &&
            receiver != null && receiver != "" && receiver != undefined &&
            hash != null && hash != "" && hash != undefined) {
            //console.log("adding wallet\n");
            accounts.push([wallet, receiver, 1, amount, hash]);
            accList.add(receiver);
          }
        }
        accList.delete(wallet);
        getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db);
      }

    } else {
      console.log("[WARN] Wallet " + wallet + " does not have any receivers.");
      accList.delete(wallet);
      getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db);
    }


    //cursor.forEach(function(result) {
    /*
        dbo.collection('Transaction').find(query, function(err, result) {
          if (err) {
            console.log(err);
            throw err;
          }

          var contador = 0;

        

        
        
                console.log("Contador es " + contador);
                console.log("Results length IS : " + results.length);
                console.log("Results is" + results.toString());


                console.log("Results array is " + results.toString());



                if (result.length > 0) {
                  // Receivers size for this wallet
                  var size = result.length;
                  console.log(size + " receivers for this wallet");
                  console.log("Size is " + size + " for wallet" + wallet);
                  // Number of remaining nodes to add 
                  var remainingSize = nodes - accounts.length;


                  // Max nodes number reached in this iteration
                  if (size >= remainingSize) {
                    size = remainingSize;
                    for (var i = 0; i < size; i++) {
                      //console.log(result.rows[0].receivers[i]);
                      var receiver = result[0].wallet;
                      var amount = result[0].amount;
                      var hash = result[0].hash;
                      //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
                      if (wallet != null && wallet != "" && wallet != undefined &&
                        receiver != null && receiver != "" && receiver != undefined &&
                        hash != null && hash != "" && hash != undefined) {
                        //console.log("adding wallet\n");
                        accounts.push([wallet, receiver, 1, amount, hash]);
                      }

                    }
                    console.log("Nodes limit achieved. Printing and exiting");
                    //console.log("Accounts is " + accounts);
                    printTransCassandra(res, type, accounts);
                    return db.close();
                  } else {
                    for (var i = 0; i < size; i++) {
                      //console.log(result.rows[0].receivers[i]);
                      var receiver = result[0].receiver;
                      var amount = result[0].amount;
                      var hash = result[0].hash;
                      //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
                      if (wallet != null && wallet != "" && wallet != undefined &&
                        receiver != null && receiver != "" && receiver != undefined &&
                        hash != null && hash != "" && hash != undefined) {
                        //console.log("adding wallet\n");
                        accounts.push([wallet, receiver, 1, amount, hash]);
                        accList.add(receiver);
                      }
                    }
                    accList.delete(wallet);
                    getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db);
                  }

                } else {
                  console.log("[WARN] Wallet " + wallet + " does not have any receivers.");
                  accList.delete(wallet);
                  getReceiversForWalletInMongo(accList, res, type, accounts, nodes, dbo, db);
                }

                
        });
    */
  }
}



async function getTxsFromWallet(resutlt) {



}



// --- CASSANDRA START  ---



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
        //getWalletTreeFromCassandra(res, wallet, nodes, levels, type);
        getWalletTreeFromMongo(res, wallet, nodes, levels, type);
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
    //getWalletTreeFromCassandra(res, wallet, nodes, levels, type);
    getWalletTreeFromMongo(res, wallet, nodes, levels, type);
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

  var accounts = new Array();
  accounts.push(["source", "target", "weight", "ether", "hash"]);
  var accList = new Set();
  dbo.connect(function(err) {
    if (err) {
      console.error("An error ocurred while connecting to the DDBB." + err);
      return;
    }
    accList.add(wallet);
    getReceiversForWallet(accList, res, type, accounts, nodes, dbo);
  });
}



function getReceiversForWallet(accList, res, type, accounts, nodes, dbo) {
  if (accList.size < 1) {
    //console.log("From is \n" + accForm);
    //console.log("To is \n" + accTo);
    console.log("Nodes limit achieved. Printing and exiting");
    printTransCassandra(res, type, accounts);
    return;
  } else {
    var query = 'SELECT receivers FROM wallets WHERE id=?';
    // Get the next one
    var wallet = accList.values().next().value;
    //console.log("Next wallet from set is " + wallet + ".\n");
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
        if (result == null || result == undefined || result.rows[0] == null ||
          result.rows[0] == undefined || result.rows[0].receivers == null ||
          result.rows[0].receivers == undefined) {
          accList.delete(wallet);
          getReceiversForWallet(accList, res, type, accounts, nodes, dbo);
        } else {
          // Receivers size for this wallet
          var size = result.rows[0].receivers.length;
          console.log(size + " receivers for this wallet");
          //console.log("Size is " + size);
          // Number of remaining nodes to add 
          var remainingSize = nodes - accounts.length;
          // Max nodes number reached in this iteration
          if (size >= remainingSize) {
            size = remainingSize;
            for (var i = 0; i < size; i++) {
              //console.log(result.rows[0].receivers[i]);
              var receiver = result.rows[0].receivers[i].wallet;
              var amount = result.rows[0].receivers[i].amount;
              var hash = result.rows[0].receivers[i].txhash;
              //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
              if (wallet != null && wallet != "" && wallet != undefined &&
                receiver != null && receiver != "" && receiver != undefined &&
                hash != null && hash != "" && hash != undefined) {
                //console.log("adding wallet\n");
                accounts.push([wallet, receiver, 1, amount, hash]);
              }

            }
            console.log("Nodes limit achieved. Printing and exiting");
            //console.log("Accounts is " + accounts);
            printTransCassandra(res, type, accounts);
            return;
          } else {
            for (var i = 0; i < size; i++) {
              var receiver = result.rows[0].receivers[i].wallet;
              var amount = result.rows[0].receivers[i].amount;
              var hash = result.rows[0].receivers[i].txhash;
              //console.log("RECEIVER is " + receiver + " AMOUNT is " + amount + " HASH is " + hash);
              if (wallet != null && wallet != "" && wallet != undefined &&
                receiver != null && receiver != "" && receiver != undefined &&
                hash != null && hash != "" && hash != undefined) {
                accounts.push([wallet, receiver, 1, amount, hash]);
                accList.add(receiver);
              }

            }
            accList.delete(wallet);
            getReceiversForWallet(accList, res, type, accounts, nodes, dbo);
          }
        }
      });
  }
}


// Save accounts to CSV and call the R script.
function printTransCassandra(res, type, accounts) {
  accountsVisualization = groupPairsOfNodesForVisualization(accounts);
  accounts = groupPairsOfNodes(accounts);
  accountsToCSV = csv(accounts);
  if (CSVWrite) {
    try {
      fs.writeFileSync('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', accountsToCSV, 'utf8');
    } catch (error) {
      console.log("Error while writing CSVfrom.csv file.");
      //TODO RENDER ERROR CODE


      return;
    }
    if (type == "normal") {
      //console.log("Calling RCallNormal()");
      RCallNormal(res, accountsVisualization);
    } else if (type == "betweenness") {
      RCallBetween(res, accountsVisualization);
      //console.log("Calling RCallBetween()");
    } else {
      console.log("Wrong input type.");
    }

    /*
    fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', accountsToCSV, 'utf8', function(err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } else {
        console.log('CSVfrom.csv saved!');
      }
      //return;
      // Type of graph to compute/print      
      if (type == "normal") {
        //console.log("Calling RCallNormal()");
        RCallNormal(res, accountsVisualization);
      } else if (type == "betweenness") {
        RCallBetween(res, accountsVisualization);
        //console.log("Calling RCallBetween()");
      } else {
        console.log("Wrong input type.");
      }
    });
    */
  }
}



/*
----- Auxiliary funtions
*/

//This doesn't scale very well
function groupPairsOfNodes(accounts) {
  var groupedAccounts = new Array();
  var setAccounts = new Set();
  groupedAccounts.push(["source", "target", "weight"]);
  for (var i = 1; i < accounts.length; i++) {
    var counter = 1;
    if (setAccounts.has(accounts[i][0] + accounts[i][1])) {
      continue;
    }
    if (i == (accounts.length - 1)) {
      groupedAccounts.push([accounts[i][0], accounts[i][1], counter]);
    }
    for (var j = i + 1; j < accounts.length; j++) {
      if (accounts[i][0] == accounts[j][0] && accounts[i][1] == accounts[j][1]) {
        counter++;
      }
      if (j == (accounts.length - 1)) {
        if (!setAccounts.has(accounts[i][0] + accounts[i][1])) {
          groupedAccounts.push([accounts[i][0], accounts[i][1], counter]);
          setAccounts.add(accounts[i][0] + accounts[i][1]);
        }
      }
    }
  }
  return groupedAccounts;
}

function groupPairsOfNodesForVisualization(accounts) {
  var groupedAccounts = new Array();
  var setAccounts = new Set();
  groupedAccounts.push(["source", "target", "weight", "ether", "hash"]);
  for (var i = 1; i < accounts.length; i++) {
    var counter = 1;
    var ether = accounts[i][3];
    if (setAccounts.has(accounts[i][0] + accounts[i][1])) {
      continue;
    }
    if (i == (accounts.length - 1)) {
      groupedAccounts.push([accounts[i][0], accounts[i][1], counter, ether, accounts[i][4]]);
    }
    for (var j = i + 1; j < accounts.length; j++) {
      if (accounts[i][0] == accounts[j][0] && accounts[i][1] == accounts[j][1]) {
        counter++;
        //console.log("This tx ether is " + accounts[j][3]); 
        ether += accounts[j][3];
        //console.log("New ether is " + ether);
      }
      if (j == (accounts.length - 1)) {
        if (!setAccounts.has(accounts[i][0] + accounts[i][1])) {
          // We always add the txHash, but if counter!=1, the next function (generateJson) won't use that in the view
          groupedAccounts.push([accounts[i][0], accounts[i][1], counter, ether, accounts[i][4]]);
          setAccounts.add(accounts[i][0] + accounts[i][1]);
        }
      }
    }
  }
  return groupedAccounts;
}

// This function writes the nodes and links information into a JSON file, so that the view is able to represent the graph
function generateJSON(res, accounts, type) {
  // Generating the links part
  var links = new Array();
  for (var i = 1; i < accounts.length; i++) {
    var txInformationToDisplay = "";
    if (accounts[i][2] == 1) {
      //txInformationToDisplay = "hash:"+accounts[i][4];
      txInformationToDisplay = "hash:" + accounts[i][4] + "; ether:" + accounts[i][3];
    } else {
      //txInformationToDisplay = "txNumber:"+accounts[i][2];
      txInformationToDisplay = "number:" + accounts[i][2] + "; ether:" + accounts[i][3];
    }
    links.push({
      source: accounts[i][0],
      target: accounts[i][1],
      tx: txInformationToDisplay
    });
  }

  // Generating the nodes part
  var nodes = new Array();
  var content = null;

  try {
    content = fs.readFileSync('/home/ether/EthereumTracking/TFM/R/result.csv', 'utf8');
  } catch (error) {
    console.log("Error reading result.csv file.");
    // TODO render an error message 

    return;
  }

  // thanks to https://csv.js.org/parse/api/#sync-api
  var records = parse(content, {
    columns: true,
    skip_empty_lines: true
  });


  //
  if (type == "normal") {
    for (var i = 0; i < records.length; i++) {
      nodes.push({
        name: records[i][Object.keys(records[i])[0]].substring(0, 7),
        id: records[i][Object.keys(records[i])[0]]
      });
    }
  } else if (type == "betweenness") {
    // Get fill maximum value to configure the color range
    var maxColor = 0;
    for (var i = 0; i < records.length; i++) {
      if (records[i].result > maxColor) {
        maxColor = records[i].result;
      }
    }

    //var colorHexRange = Math.pow(2, 12)-1; // If the maximum is #FFF
    var colorHexRange = 3000; // The above number yields to blank nodes if FFF

    for (var i = 0; i < records.length; i++) {
      var fillValue = Math.floor(((records[i].result) / maxColor) * colorHexRange).toString(16);
      console.log("Color for " + records[i].result + " is " + fillValue + "\n");
      nodes.push({
        name: records[i][Object.keys(records[i])[0]].substring(0, 7),
        id: records[i][Object.keys(records[i])[0]],
        fill: "#" + fillValue
      });
    }
  }
  //

  // Writing to JSON file
  var jsonOutput = {
    "nodes": nodes,
    "links": links
  };

  try {
    fs.writeFileSync('/home/ether/EthereumTracking/TFM/EthereumStats/public/result.json', JSON.stringify(jsonOutput), 'utf8');
  } catch (error) {
    console.log("Error while writing result.json");
    //TODO render error page

    return;
  }
  console.log("JSON created.");
}


/*
  fs.writeFile('/home/ether/EthereumTracking/TFM/EthereumStats/app/views/result.json', JSON.stringify(jsonOutput), 'utf8', function(err) {
    if (err) {
      console.error('Some error occured - file either not saved or corrupted file saved.', err);
    } else {
      console.log('It\'s saved!');
    }
  });
}
*/

/*
----- 
*/



/*
----- Functions below were created just to test a few things. Only useful for debugging
*/

// Test to store an array as .csv
// Desired outputd: source,target,weight
//  0x0...0,0x0...1,1
//  0x1...0,0x1...1,1
router.get('/CSVTest', function(req, res) {
  a = new Array();
  a.push(["source", "target", "weight"]);
  a.push(['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 1, 1, 'primera']);
  a.push(['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000002', 1, 2, 'segunda']);
  a.push(['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 1, 3, 'tercera']);
  a.push(['0x1111111111111111111111111111111111111110', '0x1111111111111111111111111111111111111111', 1, 4, 'cuarta']);
  a.push(['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 1, 5, 'quinta']);
  b = groupPairsOfNodesForVisualization(a);
  a = groupPairsOfNodes(a);
  //console.log(a);

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