# ReduceColours-js
Reduce the number of colours in an image and output a pallet

This is a simple project I made for fun which uses OctTrees to store RGB colours from an image. It then uses the resulting OctTree to produce an optimised colour pallet which minimises the error between its self and the original image. Any number of colours can be specified and its more efficient to provide multiple at once so it can reuse the constructed tree.

## Installation

1) Download the project through your preferred method.
2) Install the node modules with `npm i`
3) Your done, you can run the program using `node ./multi.js <imagePath> <desiredColourCount>[,furtherColourCount]`

### Examples:

* `node ./multi.js ./input.png 64` - Output an image and a pallet using only 64 colours
* `node ./multi.js ./input.png 64,128,256` - Output three images and three pallets using only 64, 128 and 256 colours