-- Update the editable notice and tour copy for existing availability pages.
UPDATE public.property_availability
SET data = jsonb_set(
             jsonb_set(
               jsonb_set(data, '{statusNotice}', to_jsonb($notice$Hello! My name is Danielle Patchen, and I’ll assist you with scheduling a tour of this property.

Although the property is still listed for sale on Zillow, Opendoor, and other platforms, the owner has also made it available for rent or rent-to-own. The sales listings may remain active while rental applications are being considered and will be removed once a rental agreement is finalized.$notice$::text)),
               '{tourIntro}',
               to_jsonb($tour$To schedule a viewing, click the “Schedule a Tour” button below to create your tour account, choose your preferred date and time, and complete identity verification.$tour$::text)
             ),
             '{tourDetails}',
             to_jsonb($details$Once your request is approved, you’ll receive a door access code to enter the property through the OpenDoor app.$details$::text)
           ),
    updated_at = now();
