import React from 'react'
import ReactDOM from 'react-dom'
import pdfu from 'pd-fileutils'
import Pd from 'webpd'
import R from 'ramda'

class AbstractRenderer extends React.Component {
  opts = {
    portletWidth: 5,
    portletHeight: 3.5,
    objMinWidth: 25,
    objMinHeight: 20,
    ratio: 1.2,
    padding: 10,
    glyphWidth: 8,
    glyphHeight: 9,
    textPadding: 6,
    svgFile: true
  }
}

class NodeRenderer extends AbstractRenderer {
  get node() {
    return this.props.node
  }
  get object() {
    return this.props.object
  }

  // Returns node X in the canvas
  getX() { return this.node.layout.x * this.opts.ratio }

  // Returns node Y in the canvas
  getY() { return this.node.layout.y * this.opts.ratio }

  // Returns outlet's absolute X in the canvas
  getOutletX(outlet) {
    return this.getOutletRelX(outlet) + this.getX()
  }

  // Returns intlet's absolute X in the canvas
  getInletX(inlet) {
    return this.getInletRelX(inlet) + this.getX()
  }

  // Returns outlet's Y in the canvas
  getOutletY(outlet) {
    return this.getOutletRelY(outlet) + this.getY()
  }

  // Returns inlet's Y in the canvas
  getInletY(inlet) {
    return this.getInletRelY(inlet) + this.getY()
  }

  // ---- Methods to implement ---- //
  // Do the actual rendering in svg group `g`.
  render(g) { throw new Error('Implement me') }

  // Returns the width of the bounding box of the node
  getW() { throw new Error('Implement me') }

  // Returns the height of the bounding box of the node
  getH() { throw new Error('Implement me') }

  // Returns outlet X relatively to the node
  getOutletRelX(outlet) { throw new Error('Implement me') }

  // Returns inlet X relatively to the node
  getInletRelX(inlet) { throw new Error('Implement me') }

  // Returns outlet Y relatively to the node
  getOutletRelY(outlet) { throw new Error('Implement me') }

  // Returns inlet Y relatively to the node
  getInletRelY(inlet) { throw new Error('Implement me') }

}

class ObjectRenderer extends NodeRenderer {
  render() {
    const boxStyle = {
      stroke: 'black',
      fill: 'white'
    }
    return (
      <g className={"node"} id={this.node.id} transform={`translate(${this.getX()} ${this.getY()})`}>
        <rect className={"box"} width={this.getW()} height={this.getH()} style={boxStyle} />
        <text className={"proto"} dy={this.getTextY()} dx={this.opts.textPadding}>
          {this.getText()}
        </text>
        {this._genericRenderPortlets('inlet')}
        {this._genericRenderPortlets('outlet')}
      </g>
    )
  }


  getH() {
    return this.opts.objMinHeight
  }
  getW() {
    const maxPortlet = Math.max(this.object.inlets.length, this.object.outlets.length)
      , textLength = this.getText().length * this.opts.glyphWidth + this.opts.textPadding * 2

    return Math.max((maxPortlet-1) * this.opts.objMinWidth, this.opts.objMinWidth, textLength)
  }
  getText() {
    return this.node.proto + ' ' + this.node.args.join(' ')
  }
  getTextY() {
    return this.getH()/2 + this.opts.glyphHeight/2
  }

  // ---- Implement virtual methods ---- //
  getOutletRelX(outlet) {
    return this._genericPortletRelX('outlets', outlet)
  }

  getInletRelX(inlet) {
    return this._genericPortletRelX('inlets', inlet)
  }

  getOutletRelY(outlet) {
    return this.getH() - this.opts.portletHeight
  }

  getInletRelY(inlet) { return 0 }

  _genericPortletRelX(inOrOutlets, portlet) {
    const width = this.getW()
      , n = this.object[inOrOutlets].length
    if (portlet === 0) return 0;
    else if (portlet === n-1) return width - this.opts.portletWidth
    else {
      // Space between portlets
      const a = (width - n*this.opts.portletWidth) / (n-1)
      return portlet * (this.opts.portletWidth + a)
    }
  }

  _genericRenderPortlets(portletType) {
    const portletTypeCap = portletType.substr(0, 1).toUpperCase() + portletType.substr(1)
      , self = this

    const numPortlets = this.object[portletType+'s'].length
    const portlets = this.object[portletType+'s'] // Array.from(Array(this.object[portletType+'s']).keys())

    return (
      <g>
        {portlets.map((portlet, i) => {
          const x = self['get' + portletTypeCap + 'RelX'](i)
          const y = self['get' + portletTypeCap + 'RelY'](i)

          return (
            <rect className={[portletType, "portlet"].join(' ')}
                  width={this.opts.portletWidth}
                  height={this.opts.portletHeight}
                  x={x}
                  y={y}
                  key={i} />
          )
        })}
      </g>
    )
  }
}

class ConnectionRenderer extends AbstractRenderer {
  render() {
    const lineStyle = {
      stroke: 'black',
      strokeWidth: '2px'
    }
    const { patch } = this.props
    const conn = this.props.connection

    // HACK
    const sourceRenderer = new ObjectRenderer({
      node: patch.patchData.nodes[conn.source.id],
      object: patch.objects[patch.patchData.nodes[conn.source.id].id]
    })
    const sinkRenderer = new ObjectRenderer({
      node: patch.patchData.nodes[conn.sink.id],
      object: patch.objects[patch.patchData.nodes[conn.sink.id].id]
    })

    var x1 = sourceRenderer.getOutletX(conn.source.port) + this.opts.portletWidth/2
    var y1 = sourceRenderer.getOutletY(conn.source.port) + this.opts.portletHeight

    var x2 = sinkRenderer.getInletX(conn.sink.port) + this.opts.portletWidth/2
    var y2 = sinkRenderer.getInletY(conn.sink.port)

    return (
      <line
        className={"connection"}
        style={lineStyle}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
      />
    )
  }
}

class PatchRenderer extends AbstractRenderer {
  render() {
    const { patch } = this.props

    // const patchStyle = {
    //   top: patch.patchData.layout.x,
    //   left: patch.patchData.layout.y,
    //   width: patch.patchData.layout.width + patch.patchData.layout.x,
    //   height: patch.patchData.layout.height + patch.patchData.layout.y
    // }

  // Calculate width / height of the SVG
    var allX1 = [], allY1 = [], allX2 = [], allY2 = []
      , topLeft = {}, bottomRight = {}
    patch.patchData.nodes.map(node => {
      return new ObjectRenderer({
        key: node.id,
        node: patch.patchData.nodes[node.id],
        object: patch.objects[node.id]
      })
    }).forEach(n => {
      allX1.push(n.getX())
      allY1.push(n.getY())
      allX2.push(n.getX() + n.getW())
      allY2.push(n.getY() + n.getH())
    })
    topLeft.x = R.reduce(R.min, Infinity, allX1)
    topLeft.y = R.reduce(R.min, Infinity, allY1)
    bottomRight.x = R.reduce(R.max, -Infinity, allX2)
    bottomRight.y = R.reduce(R.max, -Infinity, allY2)

    const opts = (new AbstractRenderer).opts // SO HACK
    const svgWidth = bottomRight.x - topLeft.x + opts.padding * 2
    const svgHeight = bottomRight.y - topLeft.y + opts.padding * 2
    const svgTransform = (
      'translate('
        + (-topLeft.x + opts.padding) + ' '
        + (-topLeft.y + opts.padding) + ')'
    )
    const patchStyle = {
      top: 0,
      left: 0,
      width: svgWidth,
      height: svgHeight,
      transform: svgTransform
    }

    return (
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={patchStyle}>
        <g>

          {patch.patchData.nodes.map((node, n) => {
            const object = patch.objects[node.id]
            return (
              <ObjectRenderer key={n} node={node} object={object} />
            )
          })}

          {patch.patchData.connections.map((connection, n) => {
            return (
              <ConnectionRenderer key={n} patch={patch} connection={connection} />
            )
          })}

        </g>
      </svg>
    )
  }
}

// var patch = new pdfu.Patch({nodes: [], connections: []})
// patch.guessPortlets()

var containerEl = document.createElement('div')
document.body.appendChild(containerEl)

// async test
setTimeout(function() {
  // var data = pdfu.parse('#N canvas 778 17 450 300 10;\n#X obj 14 13 loadbang;\n#X obj 14 64 print bla;\n#X connect 0 0 1 0;')
  var data = `
    #N canvas 609 236 450 300 10;
    #X obj 14 13 osc~ 440;
    #X obj 14 39 dac~ 2;
    #X connect 0 0 1 0;
    #X connect 0 0 1 1;
  `

  // var data = `
  //   #N canvas 49 82 450 300 10;
  //   #X obj 181 37 noise~;
  //   #X obj 182 63 lop~ 2000;
  //   #X obj 181 90 dac~;
  //   #X connect 0 0 1 0;
  //   #X connect 1 0 2 0;
  // `

  var data = `
  #N canvas 49 54 1317 714 10;
  #X obj 100 101 * 1;
  #X obj 144 102 * 2;
  #X obj 133 487 *~ 1;
  #X obj 214 488 *~ 0.5;
  #X obj 169 488 *~ 0.7;
  #X obj 258 489 *~ 0.4;
  #X obj 304 488 *~ 0.3;
  #X obj 352 488 *~ 0.25;
  #X obj 405 487 *~ 0.2;
  #X obj 453 488 *~ 0.1;
  #X obj 650 626 *~;
  #X obj 20 335 -;
  #X msg 20 312 100;
  #X obj 20 287 t b f;
  #X obj 20 359 - 50;
  #X obj 20 382 * 3;
  #X obj 650 671 *~ 10;
  #X obj 371 71 send \$0-pitch;
  #X obj 217 28 sel 0;
  #X obj 864 143 t b f;
  #X msg 864 169 48;
  #X obj 864 190 -;
  #X obj 864 217 * 10;
  #X obj 864 239 + 284;
  #X obj 650 648 lop~ 420;
  #X obj 217 4 r \$0-frequency;
  #X obj 649 695 dac~;
  #X obj 91 331 vcf~ 100 370;
  #X obj 169 331 vcf~ 100 370;
  #X obj 244 331 vcf~ 100 370;
  #X obj 392 331 vcf~ 100 370;
  #X obj 319 332 vcf~ 100 370;
  #X obj 467 331 vcf~ 100 370;
  #X obj 541 331 vcf~ 100 370;
  #X obj 613 330 vcf~ 100 370;
  #X obj 629 234 noise~;
  #X obj 154 456 * 0.005;
  #X obj 209 456 * 0.004;
  #X obj 389 456 * 0.0013;
  #X obj 452 456 * 0.0008;
  #X obj 514 456 * 0.0005;
  #X obj 326 456 * 0.0018;
  #X obj 264 456 * 0.0025;
  #X obj 20 262 r \$0-diameter;
  #X obj 767 116 r \$0-frequency;
  #X obj 864 116 r \$0-diameter;
  #X obj 100 145 line~;
  #X obj 144 145 line~;
  #X obj 193 145 line~;
  #X obj 242 144 line~;
  #X obj 291 144 line~;
  #X obj 335 145 line~;
  #X obj 380 145 line~;
  #X obj 432 145 line~;
  #X msg 100 123 \$1 20;
  #X msg 144 124 \$1 20;
  #X msg 193 124 \$1 20;
  #X msg 242 123 \$1 20;
  #X msg 291 123 \$1 20;
  #X msg 335 123 \$1 20;
  #X msg 380 123 \$1 20;
  #X obj 193 102 * 3;
  #X obj 242 102 * 4;
  #X obj 291 102 * 5;
  #X obj 335 102 * 6;
  #X obj 380 102 * 7;
  #X msg 432 123 \$1 20;
  #X obj 432 102 * 8;
  #X obj 767 144 change;
  #X obj 767 169 sel 0;
  #X msg 748 344 0 847.4;
  #X msg 816 344 1 \$1;
  #X obj 867 297 del;
  #X msg 867 344 0.627 313.5;
  #X obj 844 376 line~;
  #X obj 810 263 f 223.7;
  #X msg 794 208 bang;
  #X connect 0 0 54 0;
  #X connect 1 0 55 0;
  #X connect 2 0 10 0;
  #X connect 3 0 10 0;
  #X connect 4 0 10 0;
  #X connect 5 0 10 0;
  #X connect 6 0 10 0;
  #X connect 7 0 10 0;
  #X connect 8 0 10 0;
  #X connect 9 0 10 0;
  #X connect 10 0 24 0;
  #X connect 11 0 14 0;
  #X connect 12 0 11 0;
  #X connect 13 0 12 0;
  #X connect 13 1 11 1;
  #X connect 14 0 15 0;
  #X connect 15 0 36 0;
  #X connect 15 0 37 0;
  #X connect 15 0 42 0;
  #X connect 15 0 41 0;
  #X connect 15 0 38 0;
  #X connect 15 0 39 0;
  #X connect 15 0 40 0;
  #X connect 16 0 26 0;
  #X connect 16 0 26 1;
  #X connect 18 1 17 0;
  #X connect 18 1 0 0;
  #X connect 18 1 1 0;
  #X connect 18 1 61 0;
  #X connect 18 1 62 0;
  #X connect 18 1 63 0;
  #X connect 18 1 64 0;
  #X connect 18 1 65 0;
  #X connect 18 1 67 0;
  #X connect 19 0 20 0;
  #X connect 19 1 21 1;
  #X connect 20 0 21 0;
  #X connect 21 0 22 0;
  #X connect 22 0 23 0;
  #X connect 23 0 75 1;
  #X connect 24 0 16 0;
  #X connect 25 0 18 0;
  #X connect 27 0 2 0;
  #X connect 28 0 4 0;
  #X connect 29 0 3 0;
  #X connect 30 0 6 0;
  #X connect 31 0 5 0;
  #X connect 32 0 7 0;
  #X connect 33 0 8 0;
  #X connect 34 0 9 0;
  #X connect 35 0 27 0;
  #X connect 35 0 28 0;
  #X connect 35 0 29 0;
  #X connect 35 0 30 0;
  #X connect 35 0 31 0;
  #X connect 35 0 32 0;
  #X connect 35 0 33 0;
  #X connect 35 0 34 0;
  #X connect 36 0 4 1;
  #X connect 37 0 3 1;
  #X connect 38 0 7 1;
  #X connect 39 0 8 1;
  #X connect 40 0 9 1;
  #X connect 41 0 6 1;
  #X connect 42 0 5 1;
  #X connect 43 0 13 0;
  #X connect 44 0 68 0;
  #X connect 45 0 19 0;
  #X connect 46 0 27 1;
  #X connect 47 0 28 1;
  #X connect 48 0 29 1;
  #X connect 49 0 31 1;
  #X connect 50 0 30 1;
  #X connect 51 0 32 1;
  #X connect 52 0 33 1;
  #X connect 53 0 34 1;
  #X connect 54 0 46 0;
  #X connect 55 0 47 0;
  #X connect 56 0 48 0;
  #X connect 57 0 49 0;
  #X connect 58 0 50 0;
  #X connect 59 0 51 0;
  #X connect 60 0 52 0;
  #X connect 61 0 56 0;
  #X connect 62 0 57 0;
  #X connect 63 0 58 0;
  #X connect 64 0 59 0;
  #X connect 65 0 60 0;
  #X connect 66 0 53 0;
  #X connect 67 0 66 0;
  #X connect 68 0 69 0;
  #X connect 69 0 70 0;
  #X connect 69 1 76 0;
  #X connect 70 0 74 0;
  #X connect 71 0 74 0;
  #X connect 72 0 73 0;
  #X connect 73 0 74 0;
  #X connect 74 0 10 1;
  #X connect 75 0 71 0;
  #X connect 75 0 72 0;
  #X connect 76 0 75 0;
  `
  // var patch = new pdfu.Patch(data)
  // patch.guessPortlets()

  var patchData = Pd.parsePatch(data)
  var patch = Pd.loadPatch(patchData)
  Pd.start()

  ReactDOM.render(<PatchRenderer patch={patch} />, containerEl)
}, 1)
