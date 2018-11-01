suppressMessages(library(igraph))

library(igraph)

csv_graph <- read.csv("CSVfrom.csv", colClasses=c("character","character","numeric"))

g <- graph_from_data_frame(d=csv_graph, directed=FALSE)

result <- betweenness(g)

df <- data.frame(a3)

write.csv(df, "result.csv")