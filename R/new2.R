# Load package
library(networkD3)
library(igraph)

# Set working directory
setwd("/Volumes/Nano/Documentos/Nano/Universidad/Asignaturas/TFM/R")

# Import nodes from 2 .csv 
from <- scan('CSVfrom.csv', what=character(), sep=",", quiet=TRUE)
to <- scan('CSVto.csv', what=character(), sep=",", quiet=TRUE)

# Create a dataframe from the imported files
edgeList <- data.frame(from, to)
colnames(edgeList) <- c("SourceName", "TargetName")

# Create a graph. Use simplyfy to ensure that there are no duplicated edges or self loops
gD <- igraph::simplify(igraph::graph.data.frame(edgeList, directed=FALSE))

# Create a node list object (actually a data frame object) that will contain information about nodes
nodeList <- data.frame(ID = c(0:(igraph::vcount(gD) - 1)), # because networkD3 library requires IDs to start at 0
                       nName = igraph::V(gD)$name)

# Map node names from the edge list to node IDs
getNodeID <- function(x){
  which(x == igraph::V(gD)$name) - 1 # to ensure that IDs start at 0
}
# And add them to the edge list
edgeList <- plyr::ddply(edgeList, .variables = c("SourceName", "TargetName"), 
                        function (x) data.frame(SourceID = getNodeID(x$SourceName), 
                                                TargetID = getNodeID(x$TargetName)))

############################################################################################
# Calculate some node properties and node similarities that will be used to illustrate 
# different plotting abilities and add them to the edge and node lists

# Calculate betweenness for all nodes
betAll <- igraph::betweenness(gD, v = igraph::V(gD), directed = FALSE) / (((igraph::vcount(gD) - 1) * (igraph::vcount(gD)-2)) / 2)
betAll.norm <- (betAll - min(betAll))/(max(betAll) - min(betAll))
nodeList <- cbind(nodeList, nodeBetweenness=100*betAll.norm) # We are scaling the value by multiplying it by 100 for visualization purposes only (to create larger nodes)
rm(betAll, betAll.norm)

# Set the new property which will determine the color of the nodes, based on their betweenness
nodeList2 <- nodeList[order(nodeList$nodeBetweenness),]
nocolor <- rep(3, nrow(nodeList)-50)
color <- rep(1,50)
nodeList2 <- cbind(nodeList2, group = c(nocolor,color))

nodeList <- cbind(nodeList, group=rep(0,nrow(nodeList)))
nodeList$group[match(nodeList2$ID, nodeList$ID)] <- nodeList2$group

#Calculate Dice similarities between all pairs of nodes
dsAll <- igraph::similarity.dice(gD, vids = igraph::V(gD), mode = "all")

F1 <- function(x) {data.frame(diceSim = dsAll[x$SourceID +1, x$TargetID + 1])}
edgeList <- plyr::ddply(edgeList, .variables=c("SourceName", "TargetName", "SourceID", "TargetID"), 
                        function(x) data.frame(F1(x)))

rm(dsAll, F1, getNodeID, gD)



############################################################################################
# Let's create a network

D3_network_LM <- networkD3::forceNetwork(Links = edgeList, # data frame that contains info about edges
                                         Nodes = nodeList, # data frame that contains info about nodes
                                         Source = "SourceID", # ID of source node 
                                         Target = "TargetID", # ID of target node
                                         NodeID = "nName", # value from the node list (data frame) that contains node description we want to use (e.g., node name)
                                         Group = "group",  # value from the node list (data frame) that contains value we want to use for node color
                                         colourScale = JS("d3.scaleOrdinal(d3.schemeCategory10);"),
                                         fontSize = 20, # Font size
                                         opacity = 0.85, # opacity
                                         zoom = TRUE, # ability to zoom when click on the node
                                         opacityNoHover = 0.1) # opacity of labels when static




# Plot network
D3_network_LM 

# Save network as html file
networkD3::saveNetwork(D3_network_LM, "D3_LM2.html", selfcontained = TRUE)

