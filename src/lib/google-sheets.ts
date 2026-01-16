import { google } from 'googleapis';

export async function getGoogleSheetsClient(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth });
}

export async function appendToSheet(accessToken: string, spreadsheetId: string, range: string, values: (string | number | boolean)[][]) {
    const sheets = await getGoogleSheetsClient(accessToken);
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error appending to sheet:', error);
        throw error;
    }
}

export async function createSheet(accessToken: string, title: string) {
    const sheets = await getGoogleSheetsClient(accessToken);
    try {
        const response = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title,
                },
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error creating sheet:', error);
        throw error;
    }
}
