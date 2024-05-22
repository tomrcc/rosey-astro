const { NodeHtmlMarkdown } = require('node-html-markdown');

const fs = require('file-system');
const YAML = require('yaml');
const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);

const inputFilePath = './rosey/base.json';
const translationFilesDirPath = './rosey/translations';
const baseURL = process.env.BASEURL || 'http://localhost:1313/';
let locales = process.env.LOCALES?.toLowerCase().split(',') || [
  'es-es',
  'de-de',
  'fr-fr',
];

async function main(locale) {
  // Get the Rosey generated data
  let inputFileData = {};

  if (fs.existsSync(inputFilePath)) {
    inputFileData = await JSON.parse(fs.readFileSync(inputFilePath)).keys;
  } else {
    console.log('rosey/base.json does not exist');
  }

  // Get all the pages that appear in the base.json
  const translationEntryKeys = Object.keys(inputFileData);
  const translationEntries = translationEntryKeys.map((key) => {
    const entry = inputFileData[key];
    return entry;
  });

  let allPages = [];

  translationEntries.forEach((entry) => {
    const entrysPages = Object.keys(entry.pages);
    entrysPages.forEach((page) => {
      allPages.push(page);
    });
  });

  const pages = allPages.reduce((accumulator, item) => {
    if (!accumulator.includes(item)) {
      accumulator.push(item);
    }
    return accumulator;
  }, []);

  // Loop through the pages
  for (item in pages) {
    const page = pages[item];
    // Format the page name
    const pageName = page
      .replace('/index.html', '')
      .replace('.html', '')
      .replace('index', 'home');

    // Find the page file path
    const translationFilePath =
      translationFilesDirPath + '/' + locale + '/' + pageName + '.yaml';

    let outputFileData = {};
    let cleanedOutputFileData = {};

    // Get our old translations file
    if (fs.existsSync(translationFilePath)) {
      outputFileData = await YAML.parse(
        fs.readFileSync(translationFilePath, 'utf8')
      );
    } else {
      console.log(`${translationFilePath} does not exist, creating one now`);
      await fs.writeFileSync(translationFilePath, '_inputs: {}');
    }

    for (const inputKey in inputFileData) {
      const inputTranslationObj = inputFileData[inputKey];
      const inputTranslationObjectPages = Object.keys(
        inputTranslationObj.pages
      );

      // If input exists on this page
      if (inputTranslationObjectPages.includes(page)) {
        const originalPhrase = inputTranslationObj.original.trim();

        // Only add the key to our output data if it still exists in base.json
        // If entry no longer exists in base.json it's content has changed in the visual editor
        const outputKeys = Object.keys(outputFileData);
        outputKeys.forEach((key) => {
          if (inputKey === key) {
            cleanedOutputFileData[key] = outputFileData[key];
          }
        });

        // If entry doesn't exist in our output file, add it
        if (!cleanedOutputFileData[inputKey]) {
          cleanedOutputFileData[inputKey] = '';
        }

        // Write the string to link to the location
        const urlHighlighterWordLength = 3;
        const originalPhraseArray = originalPhrase.split(/[\s\n]+/);
        const startHighlight = encodeURI(
          originalPhraseArray
            .slice(0, urlHighlighterWordLength)
            .join(' ')
            .replaceAll('<p>', '')
            .replaceAll('</p>', '')
        );
        const endHighlight = encodeURI(
          originalPhraseArray
            .slice(
              originalPhraseArray.length - urlHighlighterWordLength,
              originalPhraseArray.length
            )
            .join(' ')
            .replaceAll('<p>', '')
            .replaceAll('</p>', '')
        );
        const encodedOriginalPhrase = encodeURI(
          originalPhrase.replaceAll('<p>', '').replaceAll('</p>', '')
        );
        const pageString = page.replace('.html', '').replace('index', '');
        const locationString =
          originalPhraseArray.length > urlHighlighterWordLength
            ? `[See Context](${baseURL}${pageString}#:~:text=${startHighlight},${endHighlight})`
            : `[See Context](${baseURL}${pageString}#:~:text=${encodedOriginalPhrase})`;

        // Create the inputs obj if there is none
        if (!cleanedOutputFileData['_inputs']) {
          cleanedOutputFileData['_inputs'] = {};
        }

        // Create the page input object
        if (!cleanedOutputFileData['_inputs']['$']) {
          cleanedOutputFileData['_inputs']['$'] = {
            type: 'object',
            comment: `[Go to Page](${baseURL}${pageString})`,
            options: {
              place_groups_below: false,
              groups: [
                {
                  heading: 'Untranslated',
                  comment: `[To be translated](${baseURL}${pageString})`,
                  inputs: [],
                },
                {
                  heading: 'Translated',
                  comment: `[Already translated](${baseURL}${pageString})`,
                  inputs: [],
                },
              ],
            },
          };
        }

        // Add each entry to our _inputs obj
        const markdownTextInput = inputKey.slice(0, 10).includes('markdown:')
        const inputType = markdownTextInput ? 'markdown' : originalPhrase.length < 20 ? 'text' : 'textarea';
        const markdownOriginal = nhm.translate(originalPhrase);
        const options = markdownTextInput ? {
          bold: true,
          italic: true,
          strike: true,
          underline: true,
          link: true,
          undo: true,
          redo: true,
          removeformat: true
        } : {};

        cleanedOutputFileData['_inputs'][inputKey] = {
          label: `Translation (${locale})`,
          hidden: originalPhrase === '' ? true : false,
          type: inputType,
          options: options,
          comment: `${markdownOriginal} | ${locationString}`,
        };

        // Add each entry to page object group depending on whether they are translated or not
        const unTranslatedPageGroup =
          cleanedOutputFileData['_inputs']['$'].options.groups[0].inputs;

        const translatedPageGroup =
          cleanedOutputFileData['_inputs']['$'].options.groups[1].inputs;

        if (cleanedOutputFileData[inputKey].length > 0) {
          translatedPageGroup.push(inputKey);
        } else {
          unTranslatedPageGroup.push(inputKey);
        }
      }

      await fs.writeFileSync(
        translationFilePath,
        YAML.stringify(cleanedOutputFileData),
        (err) => {
          if (err) throw err;
          console.log(translationFilePath + ' updated succesfully');
        }
      );
    }
  }
}

// Loop through locales
for (let i = 0; i < locales.length; i++) {
  const locale = locales[i];

  main(locale).catch((err) => {
    console.error(`Encountered an error translating ${locale}:`, err);
  });
}

module.exports = { main };
