export interface SessionStats {
  totalParticipants: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  easiestQuestion: { index: number; successRate: number } | null;
  hardestQuestion: { index: number; successRate: number } | null;
  averageResponseTime: number;
}

export function calculateSessionStats(players: any[], totalQuestionsCount: number = 18): SessionStats {
  const totalParticipants = players.length;
  if (totalParticipants === 0) {
    return {
      totalParticipants: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      easiestQuestion: null,
      hardestQuestion: null,
      averageResponseTime: 0
    };
  }

  let sumScore = 0;
  let highestScore = -Infinity;
  let lowestScore = Infinity;

  // Para calcular as taxas de acerto por questão
  const questionAttempts: Record<number, { total: number; correct: number }> = {};
  let totalTimeSum = 0;
  let timeCount = 0;

  players.forEach(player => {
    sumScore += player.score;
    if (player.score > highestScore) highestScore = player.score;
    if (player.score < lowestScore) lowestScore = player.score;

    const answers = player.answers || [];
    answers.forEach((ans: any) => {
      const qId = ans.questionId;
      if (!questionAttempts[qId]) {
        questionAttempts[qId] = { total: 0, correct: 0 };
      }
      questionAttempts[qId].total += 1;
      if (ans.isCorrect) {
        questionAttempts[qId].correct += 1;
      }

      if (ans.score) {
        let timeSec = 0;
        if (typeof ans.score.timeLeftMs === 'number') {
          timeSec = Math.max(0, (30000 - ans.score.timeLeftMs) / 1000);
          totalTimeSum += timeSec;
          timeCount++;
        } else if (typeof ans.score.phase1TimeLeftMs === 'number' || typeof ans.score.phase2TimeLeftMs === 'number') {
          const p1 = ans.score.phase1TimeLeftMs ?? 15000;
          const p2 = ans.score.phase2TimeLeftMs ?? 15000;
          timeSec = Math.max(0, ((15000 - p1) + (15000 - p2)) / 1000);
          totalTimeSum += timeSec;
          timeCount++;
        }
      }
    });
  });

  const averageScore = Math.round(sumScore / totalParticipants);
  const averageResponseTime = timeCount > 0 ? parseFloat((totalTimeSum / timeCount).toFixed(1)) : 0;

  let easiestQuestion: { index: number; successRate: number } | null = null;
  let hardestQuestion: { index: number; successRate: number } | null = null;

  let maxRate = -Infinity;
  let minRate = Infinity;

  Object.entries(questionAttempts).forEach(([qIdStr, stats]) => {
    const qId = parseInt(qIdStr, 10);
    const rate = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

    if (rate > maxRate) {
      maxRate = rate;
      easiestQuestion = { index: qId, successRate: Math.round(rate) };
    }
    if (rate < minRate) {
      minRate = rate;
      hardestQuestion = { index: qId, successRate: Math.round(rate) };
    }
  });

  return {
    totalParticipants,
    averageScore,
    highestScore: highestScore === -Infinity ? 0 : highestScore,
    lowestScore: lowestScore === Infinity ? 0 : lowestScore,
    easiestQuestion,
    hardestQuestion,
    averageResponseTime
  };
}
