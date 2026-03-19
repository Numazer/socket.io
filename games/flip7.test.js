import { playTurn } from './flip7.js'
import { describe, it, expect } from 'vitest'
import { endRound } from './flip7.js'


describe('Round - perte', () => {

  it('le joueur perd la manche si il a un doublon', () => {
    const player = {
      hand: [{ value: 3 }],
      score: 10,
      isOut: false
    }

    const deck = [{ value: 3 }]

    playTurn(player, deck)

    expect(player.isOut).toBe(true)
    expect(player.score).toBe(0)
  })

})

it('le joueur continue si pas de doublon', () => {
  const player = {
    hand: [{ value: 1 }],
    score: 0,
    isOut: false
  }

  const deck = [{ value: 2 }]

  playTurn(player, deck)

  expect(player.isOut).toBe(false)
  expect(player.hand.length).toBe(2)
})

it('le joueur fait un Flip7 avec 7 cartes différentes', () => {
  const player = {
    hand: [
      { value: 1 }, { value: 2 }, { value: 3 },
      { value: 4 }, { value: 5 }, { value: 6 }
    ],
    score: 0,
    isOut: false,
    hasFlipped7: false
  }

  const deck = [{ value: 7 }]

  playTurn(player, deck)

  expect(player.hasFlipped7).toBe(true)
})

describe('End Round', () => {

  it('calcule le score si le joueur n’est pas éliminé', () => {
    const player = {
      hand: [{ value: 1 }, { value: 2 }, { value: 3 }],
      score: 0,
      isOut: false
    }

    endRound([player])

    expect(player.score).toBe(6)
  })

  it('score = 0 si le joueur est éliminé', () => {
    const player = {
      hand: [{ value: 1 }, { value: 1 }],
      score: 10,
      isOut: true
    }

    endRound([player])

    expect(player.score).toBe(0)
  })
})

it('le joueur garde son score si il stop sans doublon', () => {
  const player = {
    hand: [{ value: 2 }, { value: 3 }],
    score: 0,
    isOut: false
  }

  endRound([player])

  expect(player.score).toBe(5)
})

it('le joueur perd même après plusieurs cartes si doublon', () => {
  const player = {
    hand: [{ value: 1 }, { value: 2 }],
    score: 10,
    isOut: false
  }

  const deck = [{ value: 2 }]

  playTurn(player, deck)

  expect(player.isOut).toBe(true)
  expect(player.score).toBe(0)
})

it('Flip7 donne bonus de 15 points', () => {
  const player = {
    hand: [
      { value: 1 }, { value: 2 }, { value: 3 },
      { value: 4 }, { value: 5 }, { value: 6 }, { value: 7 }
    ],
    score: 0,
    isOut: false
  }

  endRound([player])

  expect(player.score).toBe(28 + 15)
})