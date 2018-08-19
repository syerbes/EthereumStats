var Web3 = require('web3');
var R = require("r-script");
var csv = require("array-to-csv");
var fs = require('fs');
var net = require('net');

var accToSearch = [];
// Txs' senders accounts list
var accFrom = new Array();
// Txs' receivers accounts list
var accTo = new Array();
var txList = [];

/* Configuration parameters */

// Start block
var startBlockNumber;
// Start block on each batch
var startBlockNumberRep;
// Batch size
var n = 1000;
// Current block
var bNumber = startBlockNumber;

// -- 2 end conditions
  // Number of blocks to search
var nOfBlocksToSearch = 10000;
  // Number of nodes
var nodes = 1000;
//

// Whether to write to CSV
var CSVWrite = true;

var resGlobal;

// Using the IPC provider in node.js
const GETH_IPC_PATH = '/ethereum/red-principal/geth.ipc';
var web3 = new Web3();
web3.setProvider(GETH_IPC_PATH, net);

var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Article = mongoose.model('Article');

module.exports = function (app) {
  app.use('/', router);
};

function RCall(){
  var out = R("/home/ether/EthereumTracking/TFM/R/ND3.R")
  .data()
  .callSync();
  resGlobal.sendFile("/home/ether/EthereumTracking/TFM/R/Ejemplo.html");
}

// Testo to store an array as .csv
router.get('/CSVTest', function (req, res){
  a = new Array();
  a.push(['0x588C9C56b019F4DBd7a0497F632981599BFf61f6']);
  console.log(a);

  aToCSV = csv(a);
  var fs = require('fs');
  fs.writeFile('/home/ether/EthereumTracking/TFM/CSV/CSV.csv', aToCSV, 'utf8', function (err) {
  if (err) {
    console.error('Some error occured - file either not saved or corrupted file saved.', err);
  } else{
    console.log('It\'s saved!');
  }
});
});


// Calls the function to get a random tx
router.get('/getTxRandom', function (req, res){
  var blockNumberParam = req.query.num;
  getRandomTx(blockNumberParam, res);
});


// Get a random tx given a block number
function getRandomTx(blockNumber, res){
  var respuesta = "";
  var txlength = 0;
  web3.eth.getBlock(blockNumber, false, function (error, result) {
   if (!error && result!=null){
      if (result.transactions.length == 0){
        console.log('There are no transactions in this block.');
        return;
      }
      //console.log('Listado de transacciones del bloque ' + blockNumber + ':\n' + result.transactions);
      txlength = result.transactions.length; 
      console.info("The number of transactions in this block is: " + txlength);
      var chosenTxNumber = Math.random() * (txlength - 1);
      var chosenTx = Math.round(chosenTxNumber);
      console.log('The transaction to track is: ' + result.transactions[chosenTx]);
      res.send(result.transactions[chosenTx]);
      return;
   } else {
      if(result == null){
        console.log('Block not created yet.'); 
        return;
      }
      console.error('An error occured: ', error); 
   };
  });
};

//
// Finds the graph for this tx
router.get('/getTxTree', function (req, res){
  var tx = req.query.tx;
  txList.push(tx);
  getTxInfo(tx);
  resGlobal = res;
});

// Finds the block number, sender an receiver wallets for the tx
function getTxInfo (tx){
  console.log(tx);
  web3.eth.getTransaction(tx, function (error, result){  
     //Variables globales wallets (array con las wallets) y txs (array con las transacciones), esta última se ha añadido ya antes de
     //llamar a esta función. 
     accToSearch.push(result.from);
     accToSearch.push(result.to);
     accFrom.push([result.from]);
     accTo.push([result.to]);
     startBlockNumber = result.blockNumber;
     startBlockNumberRep = startBlockNumber;
     bNumber = result.blockNumber;
     console.log(accToSearch.length);
	 getNBlocks(startBlockNumber, n, processBlocks);
  });
};

// Returns an ordered array with the given block and the next N-1
function getNBlocks (start, n, callback){
  blocks = new Array(n);
  nOfBlocks = 0;
  var number = start;
  for (var i = start; i < (start+n); i++){
    web3.eth.getBlock(i, true, function(error, result){
      // Check this is not the end of the chain
      nOfBlocks++;
      if( (result != null) && (result.number < (startBlockNumber+nOfBlocksToSearch) ) ){
        blocks[(result.number)-start] = result;
        console.info("The result.number is " + result.number);
        console.info("nOfBlocks is " + nOfBlocks);
        if(nOfBlocks == n){
          if(blocks[n-1] != null){
            console.log("The last block number in getNBlocks is " + blocks[n-1].number);
          }
          else{
            console.warn("The last block number in getNBlocks is undefined");
          }
          startBlockNumberRep = startBlockNumberRep + n;
          callback(blocks);
        };
      }else{
      };
    });
  };
};


// Returns an array with the related transactions
function processBlocks(blocks){
  var print = false;
  var nOfBlocks = [];
  for (var i = 0; i < blocks.length; i++) {
      if (blocks[i] != null && blocks[i].transactions != null) {
         console.log("Searching for transactions in block " + blocks[i].number);
         bNumber = blocks[i].number;
         blocks[i].transactions.forEach( function(e) {
            if(accToSearch.length > 0){
               if (accToSearch.includes(e.from) && (accToSearch.length < (nodes))) {
                    //txList[e.hash] = [e.from, e.to, e.blockNumber];
                    txList.push(e.hash);
                    accToSearch.push(e.to);
                    accFrom.push([e.from]);
                    accTo.push([e.to]);
               };
            }; 
        });
        if(i == (n-1)){
          if((accToSearch.length < (nodes)) && ((bNumber+1) < ((startBlockNumber + nOfBlocksToSearch)))){
              console.info("The blockNumber is " + bNumber);
              console.info("The other variable to compare is " + (startBlockNumber + nOfBlocksToSearch));
              getNBlocks(startBlockNumberRep, n, processBlocks);
          }
          print = true;
        }
        printTrans(print);
      };
  };
};

function printTrans(print){
  if(print){
  	console.log("The graph computation has finished!");
    console.info("The transactions list is:\n"+Object.values(txList)+"\n"+ "And the group of related accounts:\n"+accToSearch);
    console.info("There are " + txList.length + " transactions and " + accToSearch.length + " accounts");

    fromToCSV = csv(accFrom);
    toToCSV = csv(accTo);

    if (CSVWrite){
        fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', fromToCSV, 'utf8', function (err) {
          if (err) {
            console.error('Some error occured - file either not saved or corrupted file saved.', err);
          } else{
            console.log('It\'s saved!');
          }

            fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVto.csv', toToCSV, 'utf8', function (err) {
              if (err) {
                console.error('Some error occured - file either not saved or corrupted file saved.', err);
              } else{
               console.log('It\'s saved!');
              }
              //?
//              CSVWrite = false;
              RCall();
            });
        });
    }
  }
}





