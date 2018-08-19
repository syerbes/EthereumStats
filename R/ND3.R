# Load package
library(networkD3)

setwd("/home/ether/EthereumTracking/TFM/R")
from <- scan('CSVfrom.csv', what=character(), sep=",", quiet=TRUE)
to <- scan('CSVto.csv', what=character(), sep=",", quiet=TRUE)

#png(filename="Ejemplo.png")


# Create fake data
#src <- c("0", "1", "0", "1")
#arget <- c("1", "2", "3", "4")
networkData <- data.frame(from, to)

# Plot
myNetwork <- simpleNetwork(networkData)
saveNetwork(myNetwork, 'Ejemplo.html', selfcontained = TRUE)

#dev.off()
