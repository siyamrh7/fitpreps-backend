const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const KLAVIYO_LIST_ID = "XE7Nbr"; // Get from Klaviyo
const KLAVIYO_REVISION = '2025-01-15'; // Set the revision date (use an appropriate recent date)

const createOrUpdateKlaviyoProfile = async (email, firstName, lastName,phone,city,country) => {
    try {
        const response = await fetch('https://a.klaviyo.com/api/profiles/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
                'revision': KLAVIYO_REVISION
            },
            body: JSON.stringify({
                data: {
                    type: "profile",
                    attributes: {
                        email,
                        first_name: firstName || null,
                        last_name: lastName || null,
                        phone_number: phone || null,
                        location: {
                            city: city || null,
                            country: country || null
                        }
                    }
                }
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log('Profile created/updated:', data);
            return data.data.id; // Return the profile ID
        } else {
            console.error('Error creating/updating profile:', data);
            return null;
        }
    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
};

const addUserToKlaviyo = async (email, firstName, lastName,phone,city,country) => {
    const profileId = await createOrUpdateKlaviyoProfile(email, firstName, lastName,phone,city,country);
    if (profileId) {
        console.log('Profile successfully created and will be added to the segment automatically.');
    }
};




module.exports = addUserToKlaviyo;
