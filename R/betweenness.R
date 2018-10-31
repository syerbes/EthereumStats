suppressMessages(library(igraph))
install.packages("igraph")

library(igraph)

csv_graph <- read.csv("CSVfrom.csv")

g <- graph_from_data_frame(d=csv_graph, directed=FALSE)

result <- betweenness(g)

df <- data.frame(a3)

write.csv(df, "result.csv")