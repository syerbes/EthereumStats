var Web3 = require('web3');
var R = require("r-script");
var csv = require("array-to-csv");
var fs = require('fs');
var net = require('net');
var exec = require('child_process').exec;

// Batch size
var n = 1000;
// Whether to write to CSV
var CSVWrite = true;


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

router.get('/', function (req, res){
  res.render('index', {title: 'Ethereum Tracking', notFound: ""})
})

router.get('/index.html', function (req, res){
  res.render('index', {title: 'Ethereum Tracking', notFound: ""})
})

// Called when req.query.type is normal
function RCallNormal(res){
  var out = R("/home/ether/EthereumTracking/TFM/R/ND3.R")
  .data()
  .callSync();
  exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr){
    res.render('response');
  }); 
}

// Called when req.query.type is betweenness
function RCallBetween(res){
  var out = R("/home/ether/EthereumTracking/TFM/R/new2.R")
  .data()
  .callSync();
  exec('cp /home/ether/EthereumTracking/TFM/R/TreeResponse.html /home/ether/EthereumTracking/TFM/EthereumStats/app/views/', function callback(error, stdout, stderr){
    res.render('response');
  }); 
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
  getRandomTx(blockNumberParam, res, false);
});


// Get a random tx given a block number
function getRandomTx(blockNumber, res, ui, nodes, nOfBlocksToSearch, txList, type){
  var respuesta = "";
  var txlength = 0;
  web3.eth.getBlock(blockNumber, false, function (error, result) {
   if (!error && result != null){
      if (result.transactions.length == 0){
        console.log('There are no transactions in this block.');
        if (ui == true) {
          res.render('index', {title: 'Ethereum Tracking', notFound: "The transaction was not found, try with another one."});
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
      if(result == null){
        console.log('The block was not created.'); 
        if(ui == true){
          res.render('index', {title: 'Ethereum Tracking', notFound: "The transaction was not found, try with another one."});
        }
        return;
      }
      console.log('An error occured: ', error); 
   };
  });
};

// Finds the graph for this tx
router.get('/getTxTree', function (req, res){
  var nodes = 250; 
  var nOfBlocksToSearch = 10000;
  var txList = [];
  var type = req.query.type;

  if(req.query.nodeNum != "" && req.query.nodeNum != null && req.query.nodeNum != undefined){
    nodes = req.query.nodeNum;  
  }
  if(req.query.bsNumber != "" && req.query.bsNumber != null && req.query.bsNumber != undefined){
    nOfBlocksToSearch = parseInt(req.query.bsNumber);
  }
  var currentNumberOfBlocks = 6218385;
  var chosenBlockNumber = Math.random() * (currentNumberOfBlocks);
  var chosenBlock = Math.round(chosenBlockNumber);
  // Regex worth it?
  var tx = req.query.tx;
  resGlobal = res;
  if(tx == "" || tx == null || tx == undefined){
    tx = getRandomTx(chosenBlock, res, true, nodes, nOfBlocksToSearch, txList, type);
  } else {
    txList.push(tx);
    console.log("The nodeNumber is: " + nodes + ".\n The nOfBlocksToSearch is: " + nOfBlocksToSearch + ".\n The TX to search is (custom): " + tx + ".\n");
    getTxInfo(tx, res, nodes, nOfBlocksToSearch, txList, type);  
  }
});

// Finds the block number, sender an receiver wallets for the tx
function getTxInfo (tx, res, nodes, nOfBlocksToSearch, txList, type){
  console.log("The transaction to track is: " + tx + ".");
  var accToSearch = new Set();
  var startBlockNumber;
  var startBlockNumberRep;
  var bNumber;
  var accFrom = new Array();
  var accTo = new Array();

  web3.eth.getTransaction(tx, function (error, result){  
   if(!error){
     //Variables globales wallets (array con las wallets) y txs (array con las transacciones), esta última se ha añadido ya antes de
     //llamar a esta función. 
     accToSearch.add(result.from);
     accToSearch.add(result.to);
     accFrom.push([result.from]);
     accTo.push([result.to]);
     startBlockNumber = result.blockNumber;
     startBlockNumberRep = startBlockNumber;
     bNumber = result.blockNumber;
     console.log("Size of accToSearch at the beginning " + accToSearch.size);
     getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);   
   } else {
    console.error("The transaction " + tx + " was not found. The error is: " + error);
    res.render('index', {title: 'Ethereum Tracking', notFound: "The transaction " + tx + " was not found, try with another one."});
  }
}); 
  
};

// Returns an ordered array with the given block and the next N-1
function getNBlocks (res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, callback){
  blocks = new Array(n);
  nOfBlocks = 0;
  var start = startBlockNumberRep;
  //var a = startBlockNumber+nOfBlocksToSearch;
  //console.log("MAX NUMBER IS: " + a);
  //var number = start;
  for (var i = start; i < (start+n); i++){
    web3.eth.getBlock(i, true, function(error, result){
      //Comprobamos que no estamos al final de la cadena
      if( (result != null) && (result.number < (startBlockNumber+nOfBlocksToSearch) ) ){
        nOfBlocks++;
        blocks[(result.number)-start] = result;
        console.log("The downloaded block number is " + result.number + " | " + parseInt(startBlockNumber+nOfBlocksToSearch) + " and nOfBlocks is " + nOfBlocks);
        if(nOfBlocks == n || ((nOfBlocks == nOfBlocksToSearch) && nOfBlocksToSearch<n) || (result.number == (startBlockNumber+nOfBlocksToSearch-1) && (nOfBlocks == n)) ){
          if(blocks[n-1] != null){
            console.log("The last block number in getNBlocks is " + blocks[n-1].number);
          }
          else{
            console.log("The last block number in getNBlocks is undefined. Batch size may be bigger than number of iterations.");
          }
          startBlockNumberRep = startBlockNumberRep + nOfBlocks;
          callback(blocks, res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback);
        };
      };
    });
  };
};


// Returns an array with the related transactions
function processBlocks(blocks, res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, start, callback){
  var nOfBlocks = [];
  for (var i = 0; i < blocks.length; i++) {
      if (blocks[i] != null && blocks[i].transactions != null) {
         console.log("Searching for transactions in block " + blocks[i].number);
         bNumber = blocks[i].number;
         blocks[i].transactions.forEach( function(e) {
            if(accToSearch.size > 0){
               if (accToSearch.has(e.from) && (accToSearch.size < (nodes))) {
                    //txList[e.hash] = [e.from, e.to, e.blockNumber];
                    txList.push(e.hash);
                    //console.log("COMPARANDO []" + [e.to] + " con " + e.to);
                    accToSearch.add([e.to]);
                    accFrom.push([e.from]);
                    accTo.push([e.to]);
                    //console.log("AccFrom is: " + accFrom.toString() + "\n and AccTo is: " + accTo.toString());
               };
            }; 
        });
        if(!((accToSearch.size < (nodes)) && ((bNumber+1) < ((startBlockNumber + nOfBlocksToSearch))))){
          printTrans(true, res, txList, type, accFrom, accTo, accToSearch);
          return;
        }else if(i == (blocks.length-1)){
          if((accToSearch.size < (nodes)) && ((bNumber+1) < ((startBlockNumber + nOfBlocksToSearch)))){
              console.log("The blockNumber is " + bNumber);
              console.log("The other variable to compare is " + (startBlockNumber + nOfBlocksToSearch));
              getNBlocks(res, nodes, nOfBlocksToSearch, txList, type, accFrom, accTo, accToSearch, startBlockNumberRep, bNumber, startBlockNumber, processBlocks);
          }
        }
      };
  };
};

// Save accounts to CSV and call the R script.
function printTrans(pintar, res, txList, type, accFrom, accTo, accToSearch){
  if(pintar){
    //console.log("END. The transactions list is:\n"+Object.values(txList)+"\n"+ "And the group of related accounts:\n"+accToSearch.toString());
    console.log("There are " + txList.length + " transactions and " + accToSearch.size + " accounts");

    fromToCSV = csv(accFrom);
    toToCSV = csv(accTo);

    if (CSVWrite){
        fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVfrom.csv', fromToCSV, 'utf8', function (err) {
          if (err) {
            console.log('Some error occured - file either not saved or corrupted file saved.');
          } else{
            console.log('CSVfrom.csv saved!');
          }

            fs.writeFile('/home/ether/EthereumTracking/TFM/R/CSVto.csv', toToCSV, 'utf8', function (err) {
              if (err) {
                console.log('Some error occured - file either not saved or corrupted file saved.');
              } else{
               console.log('CSVto.csv saved!');
              }
              if(type=="normal"){
                console.log("Calling RCallNormal()");
                RCallNormal(res);
              } else if (type=="betweenness"){
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





