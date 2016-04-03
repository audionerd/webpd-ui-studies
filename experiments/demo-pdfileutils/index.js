import React from 'react'
import ReactDOM from 'react-dom'
import pdfu from 'pd-fileutils'

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
    const maxPortlet = Math.max(this.node.inlets, this.node.outlets)
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
      , n = this.node[inOrOutlets]
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

    const numPortlets = this.node[portletType+'s']
    const portlets = Array.from(Array(this.node[portletType+'s']).keys())

    return (
      <g>
        {portlets.map(i => {
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
    const sourceRenderer = new ObjectRenderer({ node: patch.getNode(conn.source.id) })
    const sinkRenderer = new ObjectRenderer({ node: patch.getNode(conn.sink.id) })

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
    var { patch } = this.props
    return (
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
        <g>

          {patch.nodes.map((node, n) => {
            return (
              <ObjectRenderer key={n} node={node} />
            )
          })}

          {patch.connections.map((connection, n) => {
            return (
              <ConnectionRenderer key={n} patch={patch} connection={connection} />
            )
          })}

        </g>
      </svg>
    )
  }
}

var data = pdfu.parse('#N canvas 778 17 450 300 10;\n#X obj 14 13 loadbang;\n#X obj 14 64 print bla;\n#X connect 0 0 1 0;')
var patch = new pdfu.Patch(data)
patch.guessPortlets()

var containerEl = document.createElement('div')
document.body.appendChild(containerEl)
ReactDOM.render(<PatchRenderer patch={patch} />, containerEl)
