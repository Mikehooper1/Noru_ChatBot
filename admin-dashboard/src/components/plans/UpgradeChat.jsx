import { useState } from 'react';
import { PLANS } from '../../constants/plans';
import { Button } from '../shared/Button';

const BOT_MESSAGES = [
  { role: 'bot', text: 'Hi! I\'m Noru — your AI agent platform assistant. I help businesses chat, book appointments, and send reminders on Website, WhatsApp & Telegram.' },
  { role: 'bot', text: 'Choose a plan below to unlock more channels and longer chat memory. Pay securely with UPI or Card.' },
];

export default function UpgradeChat({ currentPlan, onSelectPlan, paying }) {
  const [messages] = useState(BOT_MESSAGES);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[420px]">
      <div className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🤖</div>
        <div>
          <p className="font-semibold text-sm">Noru Upgrade Assistant</p>
          <p className="text-xs opacity-80">Current plan: {PLANS[currentPlan]?.name || 'Free'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm max-w-[90%]">
            {msg.text}
          </div>
        ))}

        <div className="space-y-2 pt-2">
          {Object.values(PLANS).filter((p) => p.id !== 'free').map((plan) => (
            <div key={plan.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">{plan.name}</p>
                  <p className="text-xs text-gray-500">{plan.sessionRetention} memory · {plan.features[1]}</p>
                </div>
                <p className="font-bold text-primary">{plan.priceLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 text-xs py-1.5"
                  disabled={currentPlan === plan.id || paying === plan.id}
                  onClick={() => onSelectPlan(plan.id, 'upi')}
                >
                  {paying === plan.id ? 'Processing...' : '💳 Pay with UPI'}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 text-xs py-1.5"
                  disabled={currentPlan === plan.id || paying === plan.id}
                  onClick={() => onSelectPlan(plan.id, 'card')}
                >
                  Pay with Card
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-center">
        Secured by Razorpay · UPI, Cards, Netbanking
      </div>
    </div>
  );
}
