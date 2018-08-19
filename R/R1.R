###
# Ejemplos para generar grafos.
#
# Extraido de: http://kateto.net/networks-r-igraph
##

# Lo primero de todo es importar la librer�a "igraph"

library(igraph)
library(data.tree)
##
# Para generar un grafo completo
##

#fg <- make_full_graph(40)
#plot(fg, vertex.size=10, vertex.label=NA)

##
# Crea un grafo sin enlaces
##

#eg <- make_empty_graph(40)

#plot(eg, vertex.size=10, vertex.label=NA)

##
# Grafo topograf�a en estrella
##

#st <- make_star(40)

#plot(st, vertex.size=10, vertex.label=NA)

paste5 <- function(..., sep = " ", collapse = NULL, na.rm = T) {
  if (na.rm == F)
    paste(..., sep = sep, collapse = collapse)
  else
    if (na.rm == T) {
      paste.na <- function(x, sep) {
        x <- gsub("^\\s+|\\s+$", "", x)
        ret <- paste(na.omit(x), collapse = sep)
        is.na(ret) <- ret == ""
        return(ret)
      }
      df <- data.frame(..., stringsAsFactors = F)
      ret <- apply(df, 1, FUN = function(x) paste.na(x, sep))
      
      if (is.null(collapse))
        ret
      else {
        paste.na(ret, sep = collapse)
      }
    }
}

setwd("/Users/Nano/Downloads")
data = read.csv("CSV.csv")

data$pathString <- paste5(data$X1, 
                          data$X2,
                          data$X3,
                          data$X4,
                          sep = "/",
                          na.rm = TRUE)
test <- as.Node(data, na.rm = TRUE)

#tr <- make_tree(40, children = 3, mode = "undirected")

png(filename="PNG.png")

#plot(acme, vertex.size=10, vertex.label=NA)
plot(as.igraph(test, directed = TRUE, direction = "climb"))

dev.off()
