import React from 'react'

type ConnectionOptionsDatalistProps = {
  options: string[]
}

const ConnectionOptionsDatalist = ({ options }: ConnectionOptionsDatalistProps) => {
  return (
    <datalist id="network-graph-connection-options">
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  )
}

export default ConnectionOptionsDatalist
