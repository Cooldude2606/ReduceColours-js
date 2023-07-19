
import Jimp from "jimp"

class PixelColour {
    constructor(red=0, green=0, blue=0, alpha=255) {
        this.frequency = 0
        this.red = red
        this.green = green
        this.blue = blue
        this.alpha = alpha
    }

    static fromBitmap(data, idx) {
        return new PixelColour(data[idx], data[idx+1], data[idx+2], data[idx+3])
    }

    setBitmap(data, idx) {
        data[idx] = this.red
        data[idx+1] = this.green
        data[idx+2] = this.blue
        data[idx+3] = this.alpha
    }

    key() {
        return `r${this.red}g${this.green}b${this.blue}a${this.alpha}`
    }
}

class PriorityQueue {
    constructor() {
        this.heap = []
    }

    size() {
        return this.heap.length
    }

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

class TreeNode {
    constructor(pos, size) {
        this.pos = pos
        this.size = size
        this.key = null
        this.value = null
        this.children = null
    }

    keyOutsideBounds(key) {
        return key < this.pos-this.size || key > this.pos+this.size;
    }

    keyRegion(key) {
        return key <= this.pos ? 0 : 1;
    }

    split() {
        const halfSize = this.size/2
        this.children = [
            new TreeNode(this.pos-halfSize, halfSize),
            new TreeNode(this.pos+halfSize, halfSize)
        ]
    }

    setValue(key, value) {
        if (this.children == null) {
            if (this.key == null) {
                this.key = key
                this.value = value
                return
            }

            this.split()
            this.children[this.keyRegion(this.key)].setValue(this.key, this.value)
            this.key = null; this.value = null
        } 

        this.children[this.keyRegion(key)].setValue(key, value)
    }

    getValue(key) {
        if (this.key == key) return this.value;
        if (this.children == null) return null;
        if (this.keyOutsideBounds(key)) return null;
        return this.children[this.keyRegion(key)].getValue(key)
    }

    includes(key) {
        if (key == this.key) return true;
        if (this.children == null) return false;
        if (this.keyOutsideBounds(key)) return false;
        return this.children[this.keyRegion(key)].includes(key)
    }

    keys(keys=[]) {
        if (this.key) {
            keys.push(this.key)
        }
        if (this.children) {
            this.children.forEach(c => c.keys(keys))
        }
        return keys
    }

    pairs(pairs=[]) {
        if (this.key) {
            pairs.push({ key: this.key, value: this.value })
        }
        if (this.children) {
            this.children.forEach(c => c.pairs(pairs))
        }
        return pairs
    }

    pairsExcluding(excluding, pairs=[], first=false) {
        if (first && excluding.includes(this)) return pairs;
        if (this.key) {
            pairs.push({ key: this.key, value: this.value })
        }
        if (this.children) {
            this.children.forEach(c => c.pairsExcluding(excluding, pairs, true))
        }
        return pairs
    }

    validChildren() {
        return this.children ? this.children.filter(c => c.key != null || c.children != null) : []
    }

}

function readImage(image) {
    return Jimp.read(image).catch(console.log)
}

function sumFrequency(node) {
    return node.pairs().reduce((acc, pair) => acc + pair.value.frequency, 0)
}

async function main() {
    const image = await readImage("input.jpg")

    const colourMap = new Map()
    const tree = new TreeNode(128, 128)
    let max = 0

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const colour = PixelColour.fromBitmap(this.bitmap.data, idx)
        
        const exitingColour = tree.getValue(colour.blue)
        if (exitingColour) {
            exitingColour.frequency++;
        } else {
            colour.frequency++;
            tree.setValue(colour.blue, colour)
            colourMap.set(colour.key(), colour)
        }
    })

    const desired = 8
    const selected = []
    const queue = new PriorityQueue()
    queue.push(sumFrequency(tree), tree)

    while(selected.length < desired) {
        const node = queue.pop()
        node.validChildren().forEach(c => queue.push(sumFrequency(c), c))
        selected.push(node)
    }

    for (let node of selected) {
        const newColour = new PixelColour()

        let count = node.key ? node.value.frequency : 0
        let sum = node.key ? node.value.frequency*node.value.blue : 0
        if (node.key) colourMap.set(node.value.key(), newColour)

        node.pairsExcluding(selected).forEach(pair => {
            colourMap.set(pair.value.key(), newColour)
            sum += pair.value.frequency*pair.value.blue
            count += pair.value.frequency
        })

        newColour.blue = sum/count
    }

    new Jimp(256, 256, (err, output) => {
        output.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const node = tree.getValue(x)
            const value = node ? colourMap.get(node.key()).blue : 0
            const colour = new PixelColour(value, value, value)
            colour.setBitmap(this.bitmap.data, idx)
        })

        output.write("test.png")
    })

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const oldColour = PixelColour.fromBitmap(this.bitmap.data, idx)
        const node = tree.getValue(oldColour.blue)
        const newColour = colourMap.get(node.key())
        oldColour.blue = newColour.blue
        const colour = new PixelColour(0, 0, newColour.blue)
        colour.setBitmap(this.bitmap.data, idx)
    })

    image.write("out.png")
}

main()