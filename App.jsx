import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Layout, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Stethoscope,
  Pill,
  Sparkles,
  Languages,
  Copy,
  FileDown
} from 'lucide-react';

const apiKey = ""; // La clé est fournie par l'environnement d'exécution

// Prompt mis à jour : Espacement des paragraphes et Puces rondes pour les médicaments
const REANIMATION_PROMPT = `
Tu es un médecin interne en réanimation. Ta tâche est de rédiger un Compte Rendu de Sortie d'Hospitalisation (CRH) formel.

SOURCES DE DONNÉES :
1. Les "DONNÉES CLINIQUES" serviront à rédiger l'ÉVOLUTION et la SYNTHÈSE.
2. Les "DONNÉES TRAITEMENTS" serviront EXCLUSIVEMENT à remplir la section TRAITEMENT DE SORTIE.

Tu DOIS impérativement suivre la structure et le formatage ci-dessous. 

RÈGLES DE MISE EN FORME :
1. Titres principaux (#) : Seront convertis en MAJUSCULES SOULIGNÉES.
2. Sous-titres ÉVOLUTION ("Sur le plan...") : Utilise <u>...</u> (SOULIGNÉ uniquement). Le texte suit sur la même ligne.
3. SAUTE UNE LIGNE VIDE entre chaque paragraphe "Sur le plan...".
4. Sous-titres TRAITEMENT ("Par voie...") : Utilise <u>**...**</u> (GRAS et SOULIGNÉ).

# EVOLUTION DANS LE SERVICE

<u>Sur le plan neurologique :</u> (Texte sur la même ligne... Conscience, sédation, douleur, motricité...)

<u>Sur le plan hémodynamique et cardiovasculaire :</u> (Texte sur la même ligne... Tension, catécholamines, échographie cœur, œdèmes...)

<u>Sur le plan respiratoire et pulmonaire :</u> (Texte sur la même ligne... Ventilation, sevrage, oxygène, encombrement...)

<u>Sur le plan urologique et rénal :</u> (Texte sur la même ligne... Diurèse, créatinine, épurations...)

<u>Sur le plan abdominal :</u> (Texte sur la même ligne... Transit, alimentation, examen clinique...)

<u>Sur le plan chirurgical :</u> (Texte sur la même ligne... Cicatrices, redons, aspect...)

<u>Sur le plan biologique :</u> (Texte sur la même ligne... Hémoglobine, transfusion, inflammation, ionogramme...)

<u>Sur le plan ostéo-articulaire :</u> (Texte sur la même ligne... Mobilisation, kiné...)

<u>Sur le plan métabolique et nutritionnel :</u> (Texte sur la même ligne... Alimentation, diabète...)

<u>Sur le plan infectieux :</u> (Texte sur la même ligne... Fièvre, antibiotiques - molécules, dates, durées...)

<u>Sur le plan cutanéo-muqueux :</u> (Texte sur la même ligne... Escarres - stade et localisation...)

<u>Sur le plan éthique :</u> (Texte sur la même ligne... LATA, limitations...)

# SYNTHÈSE DU SÉJOUR
(Résumé concis : Patient de X ans, motif d'admission, antécédents majeurs, résumé de l'évolution globale et destination de sortie).

# TRAITEMENT DE SORTIE

Instructions pour les médicaments :
- Trie les médicaments fournis dans "DONNÉES TRAITEMENTS" par voie d'administration.
- Utilise un point "•" pour chaque médicament.
- Format : • NOM_DU_MEDICAMENT Dosage (Posologie/Fréquence)
- Exemple : 
  • PARACÉTAMOL 1g (/6h si besoin)
- Si aucune donnée pour une voie, ne rien mettre dessous.

<u>**Par voie intraveineuse :**</u>
(Lister ici avec des points "•")

<u>**Par voie sous-cutanée :**</u>
(Lister ici avec des points "•")

<u>**Par voie orale :**</u>
(Lister ici avec des points "•")

<u>**Par voie ophtalmique :**</u>
(Lister ici avec des points "•")

<u>**Par voie transdermique :**</u>
(Lister ici avec des points "•")

<u>**Autres :**</u>
(Aérosols, etc.)

<u>**Alimentation :**</u>
(Compléter)

<u>**Oxygénothérapie :**</u>
(Compléter)

<u>**Consignes sur pansements :**</u>
(Compléter)

<u>**Kinésithérapie :**</u>
(Compléter)

<u>**Soins planifiés ou à planifier :**</u> (RDV de suivi, examens en attente...)

Ton ton doit être strictement médical, professionnel et synthétique.
`;

const REPORT_TEMPLATES = [
  {
    id: 'rea_discharge',
    name: 'Synthèse Médicale',
    icon: <Activity className="w-4 h-4" />,
    description: 'Format standardisé Hôpital (Calibri 11pt)',
    systemPrompt: REANIMATION_PROMPT
  }
];

export default function App() {
  const [rawData, setRawData] = useState('');
  const [treatmentsData, setTreatmentsData] = useState('');
  const [reportType, setReportType] = useState(REPORT_TEMPLATES[0]);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const audioRef = useRef(null);

  const fetchGemini = async (prompt, systemInstruction = "", model = "gemini-2.5-flash-preview-09-2025") => {
    // Utilisation de la clé API globale
    const keyToUse = apiKey || ""; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    };

    const execute = async (retries = 0) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data;
      } catch (err) {
        if (retries < 5) {
          await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
          return execute(retries + 1);
        }
        throw err;
      }
    };
    return execute();
  };

  const generateReport = async () => {
    if (!rawData.trim() && !treatmentsData.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const combinedPrompt = `
      Voici les données pour le compte rendu :

      --- DONNÉES CLINIQUES / ÉVOLUTION ---
      ${rawData}

      --- DONNÉES TRAITEMENTS (à formater selon instructions) ---
      ${treatmentsData}
      `;

      const data = await fetchGemini(combinedPrompt, reportType.systemPrompt);
      setGeneratedReport(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
    } catch (err) {
      setError("Erreur de génération. Vérifiez votre connexion et votre clé API.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiAction = async (actionType) => {
    if (!generatedReport) return;
    setIsProcessing(true);
    let prompt = "";
    let system = "Tu es un assistant médical expert.";

    switch(actionType) {
      case 'polish':
        prompt = `Reformule ce CRH pour qu'il soit plus fluide et professionnel, sans changer le sens clinique ni les valeurs chiffrées : \n\n${generatedReport}`;
        break;
      case 'translate':
        prompt = `Traduis ce CRH médical en Anglais pour un transfert international : \n\n${generatedReport}`;
        break;
      case 'check':
        prompt = `Relis ce CRH et vérifie s'il y a des incohérences évidentes (ex: patient intubé qui mange, ou doses aberrantes) ou des éléments manquants importants pour une sortie de réa. Liste-les brièvement : \n\n${generatedReport}`;
        break;
      default: break;
    }

    try {
      const data = await fetchGemini(prompt, system);
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (actionType === 'check') {
        setGeneratedReport(prev => `${prev}\n\n---\n### ⚠️ Vérification IA (Suggestions)\n${result}`);
      } else {
        setGeneratedReport(result);
      }
    } catch (err) {
      setError("L'action a échoué.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Traitement du texte pour le rendu HTML (Word et Web)
  // Cette fonction découpe le texte en paragraphes pour appliquer le style justifié et l'indentation
  const processTextToHtml = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, index) => {
      // 1. Titres H1 (#)
      if (line.startsWith('# ')) {
        return `<h1 style="font-size: 11pt; font-weight: bold; text-transform: uppercase; text-decoration: underline; margin-top: 24px; margin-bottom: 12px; color: #000000; text-align: left;">${line.replace('# ', '')}</h1>`;
      }
      // 2. Titres H2 (##)
      if (line.startsWith('## ')) {
        return `<h2 style="font-size: 11pt; font-weight: bold; margin-top: 18px; color: #000000; text-align: left;">${line.replace('## ', '')}</h2>`;
      }
      
      // 3. Lignes vides
      if (line.trim() === '') {
        return '<p style="margin: 0; height: 12pt;">&nbsp;</p>';
      }

      // 4. Traitement du contenu des lignes
      let content = line;

      // Gestion Gras+Souligné (<u>**...**</u>) pour les voies d'administration
      content = content.replace(/<u>\*\*(.*?)\*\*<\/u>/g, '<span style="text-decoration: underline; font-weight: bold;">$1</span>');
      // Gestion Souligné simple (<u>...</u>) pour l'évolution
      content = content.replace(/<u>(.*?)<\/u>/g, '<span style="text-decoration: underline;">$1</span>');
      // Gestion Gras simple (**)
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Gestion Italique (*)
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

      // 5. Médicaments (Lignes commençant par •) -> Indentation
      if (line.trim().startsWith('•')) {
        // Retirer le point original pour le gérer proprement ou le garder avec indentation
        // Ici on le garde mais on indente le paragraphe entier
        return `<p style="margin-bottom: 6pt; margin-top: 0; text-align: justify; margin-left: 1cm; text-indent: -0.5cm;">${content}</p>`;
      }

      // 6. Paragraphes standard (Evolution, Synthèse...) -> Justifié
      return `<p style="margin-bottom: 6pt; margin-top: 0; text-align: justify;">${content}</p>`;
    }).join('');
  };

  const downloadAsWord = () => {
    if (!generatedReport) return;

    const htmlContent = processTextToHtml(generatedReport);
      
    const fileContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Compte Rendu Hospitalisation</title>
        <style>
          @page { size: A4; margin: 2.5cm; }
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.15; color: #000000; }
          /* Styles inline sont préférés pour l'export Word, mais on garde des defaults ici */
          p { margin-bottom: 6pt; text-align: justify; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', fileContent], { type: 'application/msword' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `CRH_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const textArea = document.createElement("textarea");
    textArea.value = generatedReport;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <audio ref={audioRef} hidden />
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-800 flex items-center gap-2">
              <Activity className="w-8 h-8 text-emerald-600" />
              CRHréa AI
            </h1>
            <p className="text-slate-500 mt-1">Générateur de CRH de réanimation : copier-coller les notes ICCA en vrac, pensez a bien anonymiser les données notamment les nom propres</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            {REPORT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setReportType(tpl)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  reportType.id === tpl.id 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tpl.icon}
                {tpl.name}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Input Section */}
          <div className="flex flex-col gap-4">
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[380px]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <span className="font-semibold text-slate-700 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-emerald-500" /> Données Cliniques (Évolution)
                </span>
                <span className="text-xs text-slate-400">Notes ICCA en vrac</span>
              </div>
              <textarea
                className="flex-1 p-4 outline-none resize-none bg-transparent font-mono text-sm leading-relaxed"
                placeholder="Ex: J1: intubation... J3: sevrage... Echo: FEVG 30%..."
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[200px]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <span className="font-semibold text-slate-700 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-indigo-500" /> Traitements (pour la sortie)
                </span>
                <span className="text-xs text-slate-400">Liste médicaments bruts</span>
              </div>
              <textarea
                className="flex-1 p-4 outline-none resize-none bg-transparent font-mono text-sm leading-relaxed"
                placeholder="Ex: Paracetamol 1g x4, Lovenox 0.4..."
                value={treatmentsData}
                onChange={(e) => setTreatmentsData(e.target.value)}
              />
            </div>

            <button
              onClick={generateReport}
              disabled={isLoading || (!rawData.trim() && !treatmentsData.trim())}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200 transition-all mt-2"
            >
              {isLoading ? <RefreshCw className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              Générer le CRH Structuré
            </button>
          </div>

          {/* Output Section */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <span className="font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Résultat (Format Word)
                </span>
                <div className="flex gap-2">
                  {generatedReport && (
                    <button 
                      onClick={downloadAsWord}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                      title="Télécharger pour Word"
                    >
                      <FileDown className="w-4 h-4" /> Word
                    </button>
                  )}
                  <button onClick={copyToClipboard} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Copier le texte">
                    {copySuccess ? <CheckCircle2 className="text-emerald-500 w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Aperçu web du document */}
              <div 
                className="flex-1 p-8 overflow-y-auto bg-white font-sans text-sm leading-6 ml-4 my-4 pl-6 shadow-inner bg-[url('https://www.transparenttextures.com/patterns/paper.png')]"
              >
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Activity className="w-12 h-12 animate-pulse text-emerald-500" />
                    <div className="flex flex-col items-center">
                      <p className="font-medium text-slate-600">Rédaction en cours...</p>
                      <p className="text-xs">Mise en forme "Calibri 11pt"...</p>
                    </div>
                  </div>
                ) : generatedReport ? (
                  <div dangerouslySetInnerHTML={{ __html: processTextToHtml(generatedReport) }} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic gap-2">
                    <Layout className="w-12 h-12 opacity-20" />
                    <p>Le document final s'affichera ici.</p>
                  </div>
                )}
              </div>

              {generatedReport && (
                <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-2 rounded-b-2xl">
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleAiAction('polish')}
                    className="flex-1 min-w-[120px] py-2 px-3 bg-white text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-50 flex items-center justify-center gap-1 border border-emerald-100 shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" /> Reformuler
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleAiAction('check')}
                    className="flex-1 min-w-[120px] py-2 px-3 bg-white text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-50 flex items-center justify-center gap-1 border border-amber-100 shadow-sm"
                  >
                    <AlertCircle className="w-3 h-3" /> Vérifier Cohérence
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleAiAction('translate')}
                    className="flex-1 min-w-[120px] py-2 px-3 bg-white text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1 border border-slate-200 shadow-sm"
                  >
                    <Languages className="w-3 h-3" /> Traduire (EN)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>
                <strong>Note de sécurité :</strong> En cliquant sur "Word", un fichier .doc est généré localement dans votre navigateur.
                <br/>Le document suit le formalisme : Titres soulignés en majuscules, police Calibri 11pt, sous-titres soulignés sans puces.
            </p>
        </div>

        <footer className="mt-8 text-center text-slate-400 text-xs">
          CRHréa AI • Optimisé pour la Réanimation • Gemini 2.5 Flash
        </footer>
      </div>
    </div>
  );
}
