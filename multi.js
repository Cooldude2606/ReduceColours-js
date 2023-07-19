
import Jimp from "jimp"

// Simple 3D vector which can be used to represent colour
class Vector3 {
    constructor(x, y, z) {
        this.x = x
        this.y = y
        this.z = z
    }

    // Scale a vector by a set about
    scale(s) {
        return new Vector3(this.x*s, this.y*s, this.z*s)
    }

    // Add another vector to this vector
    add(other) {
        return new Vector3(this.x+other.x, this.y+other.y, this.z+other.z)
    }

    // Add another vector to this vector
    addInPlace(other) {
        this.x += other.x; this.y += other.y; this.z += other.z
    }

    // Squared distance between this vector and another
    sqDistance(other) {
        const dx = this.x-other.x;
        const dy = this.y-other.y;
        const dz = this.z-other.z;
        return dx*dx + dy*dy + dz*dz;
    }
}

// Represent the colour of a pixel, with the frequency that this colour has appeared
class PixelColour {
    constructor(red=0, green=0, blue=0) {
        this.frequency = 0
        this.red = red
        this.green = green
        this.blue = blue
        this.replacement = null
    }

    // Create the key directly from the bitmap with no allocations
    static keyFromBitmap(data, idx) {
        return (data[idx]<<16)+(data[idx+1]<<8)+(data[idx+2])
    }

    // Use bitmap data to directly create a colour
    static fromBitmap(data, idx) {
        return new PixelColour(data[idx], data[idx+1], data[idx+2])
    }

    // Save this colour into bitmap data, inverse of fromBitmap
    setBitmap(data, idx) {
        data[idx] = this.red
        data[idx+1] = this.green
        data[idx+2] = this.blue
        data[idx+3] = 255
    }

    // Get the vector3 representation of this colour, drops alpha
    vector3() {
        return new Vector3(this.red, this.green, this.blue)
    }

    // Get the vector3 representation of this colour, drops alpha
    vector3Scaled() {
        return new Vector3(this.red*this.frequency, this.green*this.frequency, this.blue*this.frequency)
    }

    // Get the string key of this colour, retains alpha
    key() {
        return (this.red<<16)+(this.green<<8)+(this.blue)
    }
}

// A priory queue which implements a binary heap, this implementation does not support editing priorities
class PriorityQueue {
    constructor() {
        this.heap = []
    }

    // Get the size of the queue, used to test when its empty
    size() {
        return this.heap.length
    }

    // Add an item to the queue with a given key / priority
    push(key, value) {
        this.heap.push({ key: key, value: value })

        let idx = this.heap.length-1
        while (idx > 0) {
            const parent_idx = Math.floor((idx-1)/2)
            if (this.heap[parent_idx].key > this.heap[idx].key) break;
            const parent = this.heap[parent_idx]
            this.heap[parent_idx] = this.heap[idx]
            this.heap[idx] = parent
            idx = parent_idx
        }
    }

    // Remove the largest value from the heap
    pop() {
        const rtn = this.heap[0]
        if (rtn == null) throw new Error("Queue is empty")

        let last_idx = 0
        let next_idx = 2*last_idx + 1
        while (this.heap[next_idx]) {
            if (this.heap[next_idx+1] && this.heap[next_idx].key < this.heap[next_idx+1].key) next_idx++;
            this.heap[last_idx] = this.heap[next_idx]
            last_idx = next_idx
            next_idx = 2*last_idx + 1
        }

        const last_pair = this.heap.pop()
        if (last_idx != this.heap.length) this.heap[last_idx] = last_pair
        return rtn.value;
    }
}

// An OctTree node of a given size and position
class TreeNode {
    constructor(pos, size) {
        this.pos = pos
        this.size = size
        this.key = null
        this.value = null
        this.children = null
    }

    // Comparison operator used for checking if this key equals another
    keyIs(key) {
        return this.key && key.x == this.key.x && key.y == this.key.y && key.z == this.key.z
    }

    // Comparison operator used for checking which key is closet to to the center of this node
    keyDistance(key) {
        return this.pos.sqDistance(key)
    }

    // Check if a key is outside the bounds of this node, used for fast exit
    keyOutsideBounds(key) {
        const p = this.pos
        return key.x < p.x-this.size || key.x > p.x+this.size
            || key.y < p.y-this.size || key.y > p.y+this.size
            || key.z < p.z-this.size || key.z > p.z+this.size
    }

    // Get the 'region' aka child that a key resides in
    keyRegion(key) {
        let rtn = 0
        if (key.x > this.pos.x) rtn += 1;
        if (key.y > this.pos.y) rtn += 2;
        if (key.z > this.pos.z) rtn += 4;
        return rtn
    }

    // Generate the children for this node, 
    split() {
        const halfSize = this.size/2
        const p = this.pos
        this.children = [
            new TreeNode(new Vector3(p.x-halfSize, p.y-halfSize, p.z-halfSize), halfSize),
            new TreeNode(new Vector3(p.x+halfSize, p.y-halfSize, p.z-halfSize), halfSize),
            new TreeNode(new Vector3(p.x-halfSize, p.y+halfSize, p.z-halfSize), halfSize),
            new TreeNode(new Vector3(p.x+halfSize, p.y+halfSize, p.z-halfSize), halfSize),
            new TreeNode(new Vector3(p.x-halfSize, p.y-halfSize, p.z+halfSize), halfSize),
            new TreeNode(new Vector3(p.x+halfSize, p.y-halfSize, p.z+halfSize), halfSize),
            new TreeNode(new Vector3(p.x-halfSize, p.y+halfSize, p.z+halfSize), halfSize),
            new TreeNode(new Vector3(p.x+halfSize, p.y+halfSize, p.z+halfSize), halfSize)
        ]
    }

    // Sets the value of a key, allows old values to be overwritten
    setValue(key, value) {
        if (this.key == null) {
            // This node is empty so can take this key
            this.key = key
            this.value = value
            return
        } else if (this.keyIs(key)) {
            // This node has the same key, so only need to set the value
            this.value = value
            return
        } else if (this.children == null) {
            // This node has a value but no children, make children to insert into
            this.split()
        }
        
        if (this.keyDistance(this.key) > this.keyDistance(key)) {
            // The new key is closer to this node, so insert the current value into the best child
            this.children[this.keyRegion(this.key)].setValue(this.key, this.value)
            this.key = key; this.value = value;
        } else {
            // Insert the key into the best child
            this.children[this.keyRegion(key)].setValue(key, value)
        }
    }

    // Gets the value of a given key, or returns null
    getValue(key) {
        if (this.keyIs(key)) return this.value;
        if (this.children == null) return null;
        //if (this.keyOutsideBounds(key)) return null;
        return this.children[this.keyRegion(key)].getValue(key)
    }

    // Checks if this tree contains a given key
    includes(key) {
        if (this.keyIs(key)) return true;
        if (this.children == null) return false;
        //if (this.keyOutsideBounds(key)) return false;
        return this.children[this.keyRegion(key)].includes(key)
    }

    // Returns all keys descending from this node
    keys(keys=[]) {
        if (this.key) {
            keys.push(this.key)
        }
        if (this.children) {
            for (let child of this.children) child.keys(keys)
        }
        return keys
    }

    // Returns all values descending from this node
    values(values=[]) {
        if (this.key) {
            values.push(this.value)
        }
        if (this.children) {
            for (let child of this.children) child.values(values)
        }
        return values
    }

    // Same as values, but does not process nodes or they descendants if they are in the exclude list
    valuesExcluding(excluding, values=[], first=false) {
        if (first && excluding.has(this)) return values;
        if (this.key) {
            values.push(this.value)
        }
        if (this.children) {
            for (let child of this.children) child.valuesExcluding(excluding, values, true)
        }
        return values
    }

    // Get all children which are non-null leafs or have children
    validChildren() {
        return this.children ? this.children.filter(c => c.key != null || c.children != null) : []
    }

}

// Get all dependents of a node and sum their frequency
function recursiveFrequency(node, fCache) {
    const cached = fCache.get(node)
    if (cached) return cached;

    let frequency = 0
    for (let value of node.values())
        frequency += value.frequency

    fCache.set(node, frequency)
    return frequency
}

// Generate a tree and colour map from an input image
function scanImage(image, tree, colours) {
    const bufferSize = image.bitmap.data.length
    for (let idx = 0; idx < bufferSize; idx+=4) {
        const colour = PixelColour.fromBitmap(image.bitmap.data, idx)
        const key = colour.key()
        const vec3 = colour.vector3()
        const exists = colours.get(key)
        if (exists) {
            exists.frequency++;
        } else {
            colours.set(key, colour)
            tree.setValue(vec3, colour)
            colour.frequency = 1;
        }
    }
}

// Select the desired number of nodes from the colour tree
function selectNodes(tree, desired) {
    // Initiate the queue with the root of the tree
    const selected = []
    const fCache = new Map()
    const queue = new PriorityQueue()
    queue.push(recursiveFrequency(tree, fCache), tree)

    // Use the queue to select the largest nodes based on recursive frequency
    while(selected.length < desired && queue.size() > 0) {
        const node = queue.pop()
        for (let child of node.validChildren()) queue.push(recursiveFrequency(child, fCache), child)
        selected.push(node)
    }

    return selected;
}

// Generate and write an image representing the colour pallet
function saveColourPallet(selected, limit, outFile) {
    const colourCount = Math.min(selected.length, limit)
    const palletSize = Math.ceil(Math.sqrt(colourCount))
    const pallet = new Jimp(palletSize*4, palletSize*4)

    pallet.scan(0, 0, palletSize*4, palletSize*4, function(x, y, idx) {
        const index = palletSize*Math.floor(y/4)+Math.floor(x/4)
        if (index < colourCount)
            selected[index].value.replacement.setBitmap(this.bitmap.data, idx)
    })

    pallet.write(outFile)
    console.log(`Wrote to ${outFile}`)
}

async function main(input, desired) {
    // Create the map, image, and tree
    const colourMap = new Map()
    const image = await Jimp.read(input)
    const tree = new TreeNode(new Vector3(128, 128, 128), 128)
    const noExtPath = input.slice(0, input.lastIndexOf("."))

    // Read in all the colours and insert them into the map and the tree
    scanImage(image, tree, colourMap)
    console.log(`Read ${image.bitmap.height}x${image.bitmap.width} pixels containing ${colourMap.size} unique colours`)

    // Select the nodes to be used in the final image
    let maxDesired = 0
    const desiredList = desired.split(",")
    for (let index in desiredList) {
        const asNumber = Number(desiredList[index])
        desiredList[index] = asNumber
        if (asNumber > maxDesired) maxDesired = asNumber
    }

    const out = image.clone()
    const bufferSize = out.bitmap.data.length
    const selected = selectNodes(tree, maxDesired)
    let previousDesired = 0

    desiredList.sort((a,b) => a-b)
    for (let desired of desiredList) {        
        const selectedSet = new Set(selected.slice(0, desired))
        // For each of the selected nodes, calculate a weighted average to represent all its descendants
        for (let index = 0; index < desired; index++) {
            if (index >= selected.length) break
            const node = selected[index]
            if (index >= previousDesired)
                node.value.replacement = new PixelColour()
                
            // Initiate the count and sum if this node has a value
            const newColour = node.value.replacement
            let count = node.value.frequency
            let sum = node.value.vector3Scaled()

            // For all descendants, set their replacement colour and add their frequencies
            const values = node.valuesExcluding(selectedSet)
            for (let value of values) {
                sum.addInPlace(value.vector3Scaled())
                value.replacement = newColour
                count += value.frequency
            }

            // Calculate the weighted average
            sum = sum.scale(1/count)
            newColour.red = sum.x
            newColour.green = sum.y
            newColour.blue = sum.z
        }        

        // Replace all pixels with their new colour
        for (let idx = 0; idx < bufferSize; idx+=4) {
            colourMap.get(PixelColour.keyFromBitmap(image.bitmap.data, idx)).replacement.setBitmap(out.bitmap.data, idx)
        }

        // Save the image and pallet under a new name
        out.write(`${noExtPath}_reduced_${desired}.png`)
        console.log(`Wrote to ${noExtPath}_reduced_${desired}.png`)
        saveColourPallet(selected, desired, `${noExtPath}_pallet_${desired}.png`)
        previousDesired = desired
    }
}

if (process.argv.length != 4) {
    console.log("Command requires 2 arguments: <inputPath> <desiredList>")
} else {
    main(process.argv[2], process.argv[3])
}