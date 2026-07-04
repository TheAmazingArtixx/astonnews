import { jsonResponse } from "../_utils/auth.js";

export async function onRequestPost({ request, env }) {
  const data = await request.json().catch(() => null);
  if (!data) return jsonResponse({ ok: false, error: 'Données invalides.' }, 400);

  const { name, contact, reason, message } = data;
  if (!name?.trim() || !contact?.trim() || !reason?.trim() || !message?.trim()) {
    return jsonResponse({ ok: false, error: 'Tous les champs sont requis.' }, 400);
  }

  const webhookUrl = env.CONTACT_WEBHOOK_URL;
  if (!webhookUrl) {
    return jsonResponse({ ok: false, error: 'Webhook non configuré.' }, 500);
  }

  const reasonLabels = {
    partenariat: '🤝 Partenariat',
    presse:      '📰 Demande de presse',
    technique:   '🔧 Problème technique',
    autre:       '💬 Autre',
  };

  const embed = {
    username: 'Aston News — Contact',
    avatar_url: 'https://i.imgur.com/VOTRE_LOGO.png',
    embeds: [{
      title: '📬 Nouveau message de contact',
      color: 0x7c5cff,
      fields: [
        { name: 'Nom / Prénom', value: name.trim(), inline: true },
        { name: 'Email ou Discord', value: contact.trim(), inline: true },
        { name: 'Raison', value: reasonLabels[reason] || reason, inline: false },
        { name: 'Message', value: message.trim().slice(0, 1024), inline: false },
      ],
      footer: { text: 'Aston News · Formulaire de contact' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
    if (!res.ok) throw new Error('Webhook error ' + res.status);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: 'Impossible d\'envoyer le message.' }, 500);
  }
}
