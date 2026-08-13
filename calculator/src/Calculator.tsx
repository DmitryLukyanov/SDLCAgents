import { useEffect, useState } from 'react'

type Operator = '+' | '-' | '*' | '/'

function compute(left: number, right: number, operator: Operator): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return right === 0 ? NaN : left / right
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const asString = Number(value.toPrecision(12)).toString()
  return asString
}

export function Calculator() {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputDigit = (digit: string) => {
    if (display === 'Error') {
      setDisplay(digit)
      setStored(null)
      setOperator(null)
      setWaitingForOperand(false)
      return
    }

    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
      return
    }

    setDisplay(display === '0' ? digit : display + digit)
  }

  const inputDecimal = () => {
    if (display === 'Error' || waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
      return
    }

    if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  const clearAll = () => {
    setDisplay('0')
    setStored(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const toggleSign = () => {
    if (display === 'Error' || display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`)
  }

  const percent = () => {
    if (display === 'Error') return
    setDisplay(formatNumber(parseFloat(display) / 100))
  }

  const sine = () => {
    if (display === 'Error') return
    const radians = parseFloat(display) * (Math.PI / 180)
    setDisplay(formatNumber(Math.sin(radians)))
    setWaitingForOperand(true)
  }

  const chooseOperator = (nextOperator: Operator) => {
    if (display === 'Error') return

    const inputValue = parseFloat(display)

    if (stored !== null && operator && !waitingForOperand) {
      const result = compute(stored, inputValue, operator)
      const formatted = formatNumber(result)
      setDisplay(formatted)
      setStored(formatted === 'Error' ? null : result)
    } else {
      setStored(inputValue)
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const equals = () => {
    if (display === 'Error' || stored === null || operator === null) return

    const result = compute(stored, parseFloat(display), operator)
    setDisplay(formatNumber(result))
    setStored(null)
    setOperator(null)
    setWaitingForOperand(true)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event

      if (key >= '0' && key <= '9') {
        inputDigit(key)
        return
      }

      if (key === '.') {
        inputDecimal()
        return
      }

      if (key === '+' || key === '-' || key === '*' || key === '/') {
        event.preventDefault()
        chooseOperator(key)
        return
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault()
        equals()
        return
      }

      if (key === 'Escape' || key === 'Delete') {
        clearAll()
        return
      }

      if (key === '%') {
        percent()
        return
      }

      if (key === 's' || key === 'S') {
        sine()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [display, stored, operator, waitingForOperand])

  const buttons: Array<{
    label: string
    className?: string
    span?: boolean
    onClick: () => void
  }> = [
    { label: 'AC', className: 'fn', onClick: clearAll },
    { label: '±', className: 'fn', onClick: toggleSign },
    { label: '%', className: 'fn', onClick: percent },
    { label: '÷', className: 'op', onClick: () => chooseOperator('/') },
    { label: '7', onClick: () => inputDigit('7') },
    { label: '8', onClick: () => inputDigit('8') },
    { label: '9', onClick: () => inputDigit('9') },
    { label: '×', className: 'op', onClick: () => chooseOperator('*') },
    { label: '4', onClick: () => inputDigit('4') },
    { label: '5', onClick: () => inputDigit('5') },
    { label: '6', onClick: () => inputDigit('6') },
    { label: '−', className: 'op', onClick: () => chooseOperator('-') },
    { label: '1', onClick: () => inputDigit('1') },
    { label: '2', onClick: () => inputDigit('2') },
    { label: '3', onClick: () => inputDigit('3') },
    { label: '+', className: 'op', onClick: () => chooseOperator('+') },
    { label: '0', onClick: () => inputDigit('0') },
    { label: '.', onClick: inputDecimal },
    { label: 'sin', className: 'fn', onClick: sine },
    { label: '=', className: 'op', onClick: equals },
  ]

  return (
    <main className="calculator">
      <output className="display" aria-live="polite">
        {display}
      </output>
      <div className="keys">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            className={[button.className, button.span ? 'span-2' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={button.onClick}
          >
            {button.label}
          </button>
        ))}
      </div>
    </main>
  )
}
