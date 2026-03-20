export function drawCard(player, deck) {
  const card = deck.shift()
  if (card) player.hand.push(card)
  return card
}

export function hasDuplicate(player) {
  const values = player.hand.map(c => c.value)
  return new Set(values).size !== values.length
}

export function checkFlip7(player) {
  const values = player.hand.map(c => c.value)
  return new Set(values).size >= 7
}

export function calculateScore(player) {
  const sum = player.hand.reduce((acc, c) => acc + c.value, 0)
  return checkFlip7(player) ? sum + 15 : sum
}

export function playTurn(player, deck) {
  drawCard(player, deck)

  if (hasDuplicate(player)) {
    player.isOut = true
    player.score = 0
    return
  }

  if (checkFlip7(player)) {
    player.hasFlipped7 = true
  }
}

export function endRound(players) {
  players.forEach(player => {
    if (player.isOut) {
      player.score = 0
    } else {
      player.score += calculateScore(player)
    }
    player.hand = []
  })
}